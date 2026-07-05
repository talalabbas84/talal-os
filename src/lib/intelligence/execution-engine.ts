// Execution Engine — the ONLY place that writes to the database.
// Receives approved PlannedAction[] and executes them atomically (sequential, not transactional).
// No AI calls here. No inference. Pure DB writes.

import { prisma } from "@/lib/prisma";
import { computePriorityScore } from "@/utils/priority";
import type { PlannedAction, ExecutionResult } from "./types";
import type { Task, Habit } from "@prisma/client";

export async function executeActions(
  userId: string,
  actions: PlannedAction[],
): Promise<ExecutionResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const result: ExecutionResult = {
    tasksCreated: 0,
    ideasCreated: 0,
    memoriesSaved: 0,
    remindersCreated: 0,
    projectsCreated: 0,
    habitsUpdated: 0,
    journalSaved: false,
    userStateUpdated: false,
    commandsExecuted: 0,
  };

  // Prefetch for fuzzy matching (only if needed)
  const needsMatch = actions.some(
    (a) => a.type === "COMPLETE_TASK" || a.type === "COMPLETE_HABIT" || a.type === "RESCHEDULE_TASK",
  );
  const [openTasks, activeHabits] = needsMatch
    ? await Promise.all([
        prisma.task.findMany({ where: { userId, status: { not: "DONE" } } }),
        prisma.habit.findMany({ where: { userId, isActive: true } }),
      ])
    : [[] as Task[], [] as Habit[]];

  // Project cache — avoid creating duplicates across multiple CREATE_PROJECT actions
  const projectCache: Record<string, string> = {};

  for (const action of actions) {
    if (action.type === "NO_ACTION") continue;

    switch (action.type) {
      case "CREATE_TASK": {
        const { payload } = action;
        let projectId: string | null = null;

        if (payload.projectName) {
          const key = payload.projectName.toLowerCase();
          if (projectCache[key]) {
            projectId = projectCache[key]!;
          } else {
            const existing = await prisma.project.findFirst({
              where: { userId, name: { equals: payload.projectName, mode: "insensitive" } },
            });
            projectId = existing?.id ?? null;
            if (projectId) projectCache[key] = projectId;
          }
        }

        const score = computePriorityScore(payload.urgency, payload.importance, payload.energyRequired);
        await prisma.task.create({
          data: {
            title: payload.title,
            description: payload.description || null,
            priority: payload.priority,
            dueDate: payload.dueDate ? new Date(payload.dueDate + "T00:00:00.000Z") : null,
            dueTime: payload.dueTime ?? null,
            timeContext: payload.timeContext ?? null,
            needsReminder: payload.needsReminder,
            importance: payload.importance,
            urgency: payload.urgency,
            energyRequired: payload.energyRequired,
            priorityScore: score,
            userId,
            projectId,
          },
        });
        result.tasksCreated++;
        break;
      }

      case "CREATE_IDEA": {
        const { payload } = action;
        await prisma.inboxEntry.create({
          data: { title: payload.title, description: payload.description || null, category: "IDEA", userId },
        });
        result.ideasCreated++;
        break;
      }

      case "CREATE_REMINDER": {
        const { payload } = action;
        await prisma.inboxEntry.create({
          data: {
            title: payload.title,
            description: payload.when ? `When: ${payload.when}` : null,
            category: "TASK",
            userId,
          },
        });
        result.remindersCreated++;
        break;
      }

      case "CREATE_PROJECT": {
        const { payload } = action;
        const key = payload.name.toLowerCase();
        const existing = await prisma.project.findFirst({
          where: { userId, name: { equals: payload.name, mode: "insensitive" } },
        });
        if (!existing) {
          const created = await prisma.project.create({
            data: { name: payload.name, description: payload.description || null, priority: payload.priority, userId },
          });
          projectCache[key] = created.id;
          result.projectsCreated++;
        } else {
          projectCache[key] = existing.id;
        }
        break;
      }

      case "CREATE_MEMORY": {
        const { payload } = action;
        await prisma.memoryEntry.create({
          data: {
            title: payload.title,
            content: payload.content,
            type: payload.type as Parameters<typeof prisma.memoryEntry.create>[0]["data"]["type"],
            importance: payload.importance as Parameters<typeof prisma.memoryEntry.create>[0]["data"]["importance"],
            source: (payload.source ?? "CAPTURE") as Parameters<typeof prisma.memoryEntry.create>[0]["data"]["source"],
            userId,
          },
        });
        result.memoriesSaved++;
        break;
      }

      case "UPDATE_JOURNAL": {
        const { payload } = action;
        const hasContent = payload.feeling || payload.accomplished || payload.distractedBy || payload.improveTomorrow;
        if (hasContent) {
          await prisma.dailyLog.upsert({
            where: { userId_date: { userId, date: today } },
            create: {
              userId, date: today,
              feeling: payload.feeling || null,
              accomplished: payload.accomplished || null,
              distracted: payload.distractedBy || null,
              improve: payload.improveTomorrow || null,
            },
            update: {
              ...(payload.feeling && { feeling: payload.feeling }),
              ...(payload.accomplished && { accomplished: payload.accomplished }),
              ...(payload.distractedBy && { distracted: payload.distractedBy }),
              ...(payload.improveTomorrow && { improve: payload.improveTomorrow }),
            },
          });
          result.journalSaved = true;
        }
        break;
      }

      case "UPDATE_USER_STATE": {
        const { payload } = action;
        const now = new Date();
        await prisma.userState.upsert({
          where: { userId },
          create: {
            userId,
            currentMood: payload.currentMood ?? null,
            energyLevel: payload.energyLevel ?? null,
            focusLevel: payload.focusLevel ?? null,
            recoveryMode: payload.recoveryMode ?? false,
            currentMission: payload.currentMission ?? null,
            weekFocus: payload.weekFocus ?? null,
            lastReflection: payload.lastReflection ? now : null,
            lastPlanning: payload.lastPlanning ? now : null,
          },
          update: {
            ...(payload.currentMood !== undefined && { currentMood: payload.currentMood }),
            ...(payload.energyLevel !== undefined && { energyLevel: payload.energyLevel }),
            ...(payload.focusLevel !== undefined && { focusLevel: payload.focusLevel }),
            ...(payload.recoveryMode !== undefined && { recoveryMode: payload.recoveryMode }),
            ...(payload.currentMission !== undefined && { currentMission: payload.currentMission }),
            ...(payload.weekFocus !== undefined && { weekFocus: payload.weekFocus }),
            ...(payload.lastReflection && { lastReflection: now }),
            ...(payload.lastPlanning && { lastPlanning: now }),
          },
        });
        result.userStateUpdated = true;
        break;
      }

      case "ENABLE_RECOVERY_MODE": {
        await prisma.userState.upsert({
          where: { userId },
          create: { userId, recoveryMode: true },
          update: { recoveryMode: true },
        });
        result.userStateUpdated = true;
        break;
      }

      case "COMPLETE_TASK": {
        const match = findTaskFuzzy(openTasks, action.payload.taskTitle);
        if (match) {
          await prisma.task.update({ where: { id: match.id }, data: { status: "DONE" } });
          result.commandsExecuted++;
        }
        break;
      }

      case "COMPLETE_HABIT": {
        const match = findHabitFuzzy(activeHabits, action.payload.habitName);
        if (match) {
          const existing = await prisma.habitCompletion.findUnique({
            where: { habitId_date: { habitId: match.id, date: today } },
          });
          if (!existing) {
            await prisma.habitCompletion.create({ data: { habitId: match.id, date: today } });
            result.habitsUpdated++;
          }
        }
        break;
      }

      case "RESCHEDULE_TASK": {
        const match = findTaskFuzzy(openTasks, action.payload.taskTitle);
        const newDate = resolveDate(action.payload.details);
        if (match && newDate) {
          await prisma.task.update({ where: { id: match.id }, data: { dueDate: newDate } });
          result.commandsExecuted++;
        }
        break;
      }
    }
  }

  return result;
}

// ── Fuzzy matching helpers ────────────────────────────────────────────────────

function findTaskFuzzy(tasks: Task[], target: string): Task | undefined {
  const t = target.toLowerCase();
  return tasks.find((task) => {
    const title = task.title.toLowerCase();
    return title === t || title.includes(t) || (title.length >= 5 && t.includes(title.slice(0, Math.min(title.length, 12))));
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
  return isNaN(parsed.getTime()) ? null : (() => { parsed.setHours(0, 0, 0, 0); return parsed; })();
}
