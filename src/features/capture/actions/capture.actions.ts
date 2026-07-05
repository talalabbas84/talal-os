"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { buildUserContext } from "@/lib/context/context-builder";
import { saveCaptureSchema } from "../lib/schema";
import { computePriorityScore } from "@/utils/priority";
import type { ActionResult } from "@/types";
import type { CaptureResult } from "@/lib/ai/types";
import type { Task, Habit } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ── Organize ──────────────────────────────────────────────────────────────────

export async function organizeCapture(
  text: string,
): Promise<ActionResult<CaptureResult>> {
  try {
    const userId = await requireUserId();
    if (!text || text.trim().length < 3) {
      return { success: false, error: "Please type something first." };
    }
    const provider = getAIProvider();
    const { prompt: contextPrompt } = await buildUserContext(userId);
    const result = await provider.organizeCapture(text.trim(), contextPrompt);
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI is temporarily unavailable.";
    return { success: false, error: message };
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────

export interface SaveResult {
  tasksCreated: number;
  ideasCreated: number;
  remindersCreated: number;
  journalSaved: boolean;
  habitsUpdated: number;
  projectsCreated: number;
  memoriesSaved: number;
  commandsExecuted: number;
}

export async function saveCapture(
  rawInput: unknown,
): Promise<ActionResult<SaveResult>> {
  try {
    const userId = await requireUserId();
    const parsed = saveCaptureSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { tasks, ideas, habits, projects, reminders, journal, saveJournal, memories, commands } =
      parsed.data;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let tasksCreated = 0;
    let ideasCreated = 0;
    let remindersCreated = 0;
    let journalSaved = false;
    let habitsUpdated = 0;
    let projectsCreated = 0;
    let memoriesSaved = 0;
    let commandsExecuted = 0;

    // Prefetch existing tasks/habits for command matching (before creating new ones)
    const [existingTasks, existingHabits] = commands.length > 0
      ? await Promise.all([
          prisma.task.findMany({ where: { userId, status: { not: "DONE" } } }),
          prisma.habit.findMany({ where: { userId, isActive: true } }),
        ])
      : [[] as Task[], [] as Habit[]];

    // 1. Projects (user explicitly opted-in)
    const projectMap: Record<string, string> = {};
    for (const proj of projects) {
      const existing = await prisma.project.findFirst({
        where: { userId, name: { equals: proj.name, mode: "insensitive" } },
      });
      if (existing) {
        projectMap[proj.name.toLowerCase()] = existing.id;
        continue;
      }
      const created = await prisma.project.create({
        data: { name: proj.name, description: proj.description || null, priority: proj.priority, userId },
      });
      projectMap[proj.name.toLowerCase()] = created.id;
      projectsCreated++;
    }

    // 2. Tasks — save all metadata fields + computed score
    for (const task of tasks) {
      let projectId: string | null = null;
      if (task.projectName) {
        const existing = await prisma.project.findFirst({
          where: { userId, name: { equals: task.projectName, mode: "insensitive" } },
        });
        projectId = existing?.id ?? projectMap[task.projectName.toLowerCase()] ?? null;
      }

      const score = computePriorityScore(task.urgency, task.importance, task.energyRequired);

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate + "T00:00:00.000Z") : null,
          dueTime: task.dueTime ?? null,
          timeContext: task.timeContext ?? null,
          needsReminder: task.needsReminder,
          importance: task.importance,
          urgency: task.urgency,
          energyRequired: task.energyRequired,
          priorityScore: score,
          userId,
          projectId,
        },
      });
      tasksCreated++;
    }

    // 3. Ideas → Inbox
    for (const idea of ideas) {
      await prisma.inboxEntry.create({
        data: { title: idea.title, description: idea.description || null, category: "IDEA", userId },
      });
      ideasCreated++;
    }

    // 4. Reminders → Inbox
    for (const reminder of reminders) {
      await prisma.inboxEntry.create({
        data: {
          title: reminder.title,
          description: reminder.when ? `When: ${reminder.when}` : null,
          category: "TASK",
          userId,
        },
      });
      remindersCreated++;
    }

    // 5. Daily log
    if (saveJournal) {
      const { accomplished, distractedBy, improveTomorrow, feeling } = journal;
      const hasContent = accomplished || distractedBy || improveTomorrow || feeling;
      if (hasContent) {
        await prisma.dailyLog.upsert({
          where: { userId_date: { userId, date: today } },
          create: {
            userId, date: today,
            feeling: feeling || null,
            accomplished: accomplished || null,
            distracted: distractedBy || null,
            improve: improveTomorrow || null,
          },
          update: {
            ...(feeling && { feeling }),
            ...(accomplished && { accomplished }),
            ...(distractedBy && { distracted: distractedBy }),
            ...(improveTomorrow && { improve: improveTomorrow }),
          },
        });
        journalSaved = true;
      }
    }

    // 6. Habits — match by name, record completion for today
    if (habits.length > 0) {
      const userHabits = await prisma.habit.findMany({ where: { userId, isActive: true } });
      for (const captured of habits) {
        if (!captured.completed) continue;
        const match = userHabits.find(
          (h) => h.name.toLowerCase() === captured.name.toLowerCase(),
        );
        if (!match) continue;
        const existing = await prisma.habitCompletion.findUnique({
          where: { habitId_date: { habitId: match.id, date: today } },
        });
        if (!existing) {
          await prisma.habitCompletion.create({ data: { habitId: match.id, date: today } });
          habitsUpdated++;
        }
      }
    }

    // 7. Memory candidates → MemoryEntry
    for (const mem of memories) {
      await prisma.memoryEntry.create({
        data: {
          title: mem.title,
          content: mem.content,
          type: mem.type,
          importance: mem.importance,
          source: "CAPTURE",
          userId,
        },
      });
      memoriesSaved++;
    }

    // 8. Commands — execute against existing data
    for (const cmd of commands) {
      switch (cmd.type) {
        case "COMPLETE_TASK": {
          const match = findTaskFuzzy(existingTasks, cmd.target);
          if (match) {
            await prisma.task.update({
              where: { id: match.id },
              data: { status: "DONE" },
            });
            commandsExecuted++;
          }
          break;
        }
        case "COMPLETE_HABIT": {
          const match = findHabitFuzzy(existingHabits, cmd.target);
          if (match) {
            const existing = await prisma.habitCompletion.findUnique({
              where: { habitId_date: { habitId: match.id, date: today } },
            });
            if (!existing) {
              await prisma.habitCompletion.create({
                data: { habitId: match.id, date: today },
              });
              commandsExecuted++;
            }
          }
          break;
        }
        case "RESCHEDULE_TASK": {
          const match = findTaskFuzzy(existingTasks, cmd.target);
          const newDate = resolveDate(cmd.details);
          if (match && newDate) {
            await prisma.task.update({
              where: { id: match.id },
              data: { dueDate: newDate },
            });
            commandsExecuted++;
          }
          break;
        }
        case "ADD_REMINDER": {
          await prisma.inboxEntry.create({
            data: {
              title: cmd.target,
              description: cmd.details ? `When: ${cmd.details}` : null,
              category: "TASK",
              userId,
            },
          });
          commandsExecuted++;
          break;
        }
      }
    }

    revalidatePath("/tasks");
    revalidatePath("/inbox");
    revalidatePath("/daily-log");
    revalidatePath("/habits");
    revalidatePath("/projects");
    revalidatePath("/memory");
    revalidatePath("/");

    return {
      success: true,
      data: {
        tasksCreated,
        ideasCreated,
        remindersCreated,
        journalSaved,
        habitsUpdated,
        projectsCreated,
        memoriesSaved,
        commandsExecuted,
      },
    };
  } catch {
    return { success: false, error: "Failed to save. Please try again." };
  }
}

// ── Command helpers ───────────────────────────────────────────────────────────

function findTaskFuzzy(tasks: Task[], target: string): Task | undefined {
  const t = target.toLowerCase();
  return tasks.find((task) => {
    const title = task.title.toLowerCase();
    return (
      title === t ||
      title.includes(t) ||
      // match if target contains meaningful portion of title (≥5 chars)
      (title.length >= 5 && t.includes(title.slice(0, Math.min(title.length, 12))))
    );
  });
}

function findHabitFuzzy(habits: Habit[], target: string): Habit | undefined {
  const t = target.toLowerCase();
  return habits.find((h) => {
    const name = h.name.toLowerCase();
    return name === t || name.includes(t) || t.includes(name);
  });
}

function resolveDate(details: string | null): Date | null {
  if (!details) return null;
  const lower = details.toLowerCase();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lower.includes("today")) return today;

  if (lower.includes("tomorrow")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    if (lower.includes(weekdays[i]!)) {
      const d = new Date(today);
      const diff = ((i - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  const parsed = new Date(details);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  return null;
}
