"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { saveCaptureSchema } from "../lib/schema";
import type { ActionResult } from "@/types";
import type { CaptureResult } from "@/lib/ai/types";

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
    await requireUserId();
    if (!text || text.trim().length < 3) {
      return { success: false, error: "Please type something first." };
    }
    const provider = getAIProvider();
    const result = await provider.organizeCapture(text.trim());
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
}

export async function saveCapture(
  rawInput: unknown,
): Promise<ActionResult<SaveResult>> {
  try {
    const userId = await requireUserId();
    const parsed = saveCaptureSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid input.",
      };
    }

    const { tasks, ideas, habits, projects, reminders, journal, saveJournal } = parsed.data;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let tasksCreated = 0;
    let ideasCreated = 0;
    let remindersCreated = 0;
    let journalSaved = false;
    let habitsUpdated = 0;
    let projectsCreated = 0;

    // 1. Projects (confirmed by user — they arrive pre-filtered)
    const createdProjectMap: Record<string, string> = {};
    for (const proj of projects) {
      // Avoid creating a project that already exists
      const existing = await prisma.project.findFirst({
        where: { userId, name: { equals: proj.name, mode: "insensitive" } },
      });
      if (existing) {
        createdProjectMap[proj.name.toLowerCase()] = existing.id;
        continue;
      }
      const created = await prisma.project.create({
        data: {
          name: proj.name,
          description: proj.description || null,
          priority: proj.priority,
          userId,
        },
      });
      createdProjectMap[proj.name.toLowerCase()] = created.id;
      projectsCreated++;
    }

    // 2. Tasks
    for (const task of tasks) {
      let projectId: string | null = null;
      if (task.projectName) {
        const existing = await prisma.project.findFirst({
          where: { userId, name: { equals: task.projectName, mode: "insensitive" } },
        });
        projectId =
          existing?.id ?? createdProjectMap[task.projectName.toLowerCase()] ?? null;
      }
      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate + "T00:00:00.000Z") : null,
          userId,
          projectId,
        },
      });
      tasksCreated++;
    }

    // 3. Ideas → Inbox (IDEA category)
    for (const idea of ideas) {
      await prisma.inboxEntry.create({
        data: {
          title: idea.title,
          description: idea.description || null,
          category: "IDEA",
          userId,
        },
      });
      ideasCreated++;
    }

    // 4. Reminders → Inbox (TASK category, as a lightweight capture)
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
            userId,
            date: today,
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

    // 6. Habits — match by name, record completion only for completed=true
    if (habits.length > 0) {
      const userHabits = await prisma.habit.findMany({
        where: { userId, isActive: true },
      });
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
          await prisma.habitCompletion.create({
            data: { habitId: match.id, date: today },
          });
          habitsUpdated++;
        }
      }
    }

    revalidatePath("/tasks");
    revalidatePath("/inbox");
    revalidatePath("/daily-log");
    revalidatePath("/habits");
    revalidatePath("/projects");
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
      },
    };
  } catch {
    return { success: false, error: "Failed to save. Please try again." };
  }
}
