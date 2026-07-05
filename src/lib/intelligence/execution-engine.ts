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
    followUpsCreated: 0,
    growthItemsCreated: 0,
    questionsCreated: 0,
    questionsAnswered: 0,
    projectsCreated: 0,
    habitsUpdated: 0,
    journalSaved: false,
    userStateUpdated: false,
    commandsExecuted: 0,
    peopleUpdated: 0,
    insightsSaved: 0,
  };

  // Prefetch for fuzzy matching (only if needed)
  const needsMatch = actions.some(
    (a) =>
      a.type === "COMPLETE_TASK" ||
      a.type === "COMPLETE_TOP_TASK" ||
      a.type === "COMPLETE_HABIT" ||
      a.type === "RESCHEDULE_TASK" ||
      a.type === "RESCHEDULE_TOP_TASK",
  );
  const [openTasks, activeHabits] = needsMatch
    ? await Promise.all([
        prisma.task.findMany({
          where: { userId, status: { not: "DONE" } },
          orderBy: [
            { priorityScore: { sort: "desc", nulls: "last" } },
            { dueDate: { sort: "asc", nulls: "last" } },
            { updatedAt: "desc" },
          ],
        }),
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

      case "CREATE_FOLLOW_UP": {
        const { payload } = action;
        await prisma.followUp.create({
          data: {
            userId,
            title: payload.title,
            type: payload.type,
            dueDate: payload.dueDate ? new Date(payload.dueDate + "T00:00:00.000Z") : null,
            reason: payload.reason ?? null,
            createdFrom: payload.createdFrom ?? null,
          },
        });
        result.followUpsCreated++;
        break;
      }

      case "CREATE_GROWTH_ITEM": {
        const { payload } = action;
        const existing = await prisma.growthItem.findFirst({
          where: {
            userId,
            category: payload.category,
            title: { equals: payload.title, mode: "insensitive" },
          },
        });

        if (existing) {
          await prisma.growthItem.update({
            where: { id: existing.id },
            data: {
              description: payload.description ?? existing.description,
              currentStage: payload.currentStage,
              lastReviewed: parseDate(payload.lastReviewed) ?? existing.lastReviewed,
              nextReview: parseDate(payload.nextReview) ?? existing.nextReview,
              confidence: payload.confidence,
            },
          });
        } else {
          await prisma.growthItem.create({
            data: {
              userId,
              category: payload.category,
              title: payload.title,
              description: payload.description ?? null,
              currentStage: payload.currentStage,
              lastReviewed: parseDate(payload.lastReviewed),
              nextReview: parseDate(payload.nextReview),
              confidence: payload.confidence,
              sourceCaptureId: payload.sourceCaptureId ?? null,
            },
          });
          result.growthItemsCreated++;
        }
        break;
      }

      case "CREATE_FOLLOW_UP_QUESTION": {
        const { payload } = action;
        const existing = await prisma.followUpQuestion.findFirst({
          where: {
            userId,
            status: "OPEN",
            question: { equals: payload.question, mode: "insensitive" },
          },
        });

        if (!existing) {
          await prisma.followUpQuestion.create({
            data: {
              userId,
              category: payload.category,
              question: payload.question,
              reason: payload.reason ?? null,
              priority: payload.priority,
              relatedEntityType: payload.relatedEntityType ?? null,
              relatedEntityId: payload.relatedEntityId ?? null,
            },
          });
          result.questionsCreated++;
        }
        break;
      }

      case "ANSWER_FOLLOW_UP_QUESTION": {
        const now = new Date();
        const question = action.payload.questionId
          ? await prisma.followUpQuestion.findFirst({
              where: { id: action.payload.questionId, userId, status: "OPEN" },
            })
          : await prisma.followUpQuestion.findFirst({
              where: { userId, status: "OPEN" },
              orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
            });

        if (question) {
          await prisma.followUpQuestion.update({
            where: { id: question.id },
            data: { status: "ANSWERED", answeredAt: now },
          });
          await prisma.memoryEntry.create({
            data: {
              userId,
              title: `Answer: ${question.question}`,
              content: action.payload.answer,
              type: "LESSON_LEARNED",
              importance: "MEDIUM",
              source: "CAPTURE",
            },
          });
          result.questionsAnswered++;
          result.memoriesSaved++;
        }
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

      case "COMPLETE_TOP_TASK": {
        const match = openTasks[0];
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

      case "RESCHEDULE_TOP_TASK": {
        const match = openTasks[0];
        const newDate = action.payload.dueDate
          ? new Date(action.payload.dueDate + "T00:00:00.000Z")
          : resolveDate(action.payload.reason);
        if (match && newDate) {
          await prisma.task.update({ where: { id: match.id }, data: { dueDate: newDate } });
          result.commandsExecuted++;
        }
        break;
      }

      case "CREATE_PERSON_UPDATE": {
        const { payload } = action;
        const pd = payload.personData;

        // Find or create the Person record
        let person = await prisma.person.findFirst({
          where: { userId, name: { equals: payload.personName, mode: "insensitive" } },
        });

        if (!person) {
          person = await prisma.person.create({
            data: {
              userId,
              name: payload.personName,
              nickname: pd.nickname ?? null,
              relationshipType: pd.relationshipType ?? null,
              firstMetDate: pd.firstMetDate ?? null,
              firstMetLocation: pd.firstMetLocation ?? null,
              birthday: pd.birthday ?? null,
              occupation: pd.occupation ?? null,
              hometown: pd.hometown ?? null,
              notes: pd.notes ?? null,
            },
          });
        } else {
          // Update non-null fields only
          await prisma.person.update({
            where: { id: person.id },
            data: {
              ...(pd.nickname && { nickname: pd.nickname }),
              ...(pd.relationshipType && { relationshipType: pd.relationshipType }),
              ...(pd.firstMetDate && { firstMetDate: pd.firstMetDate }),
              ...(pd.firstMetLocation && { firstMetLocation: pd.firstMetLocation }),
              ...(pd.birthday && { birthday: pd.birthday }),
              ...(pd.occupation && { occupation: pd.occupation }),
              ...(pd.hometown && { hometown: pd.hometown }),
              ...(pd.notes && { notes: pd.notes }),
            },
          });
        }

        // Create PersonMemory entries
        for (const mem of payload.memories) {
          await prisma.personMemory.create({
            data: {
              userId,
              personId: person.id,
              title: mem.title,
              content: mem.content,
              type: mem.type as Parameters<typeof prisma.personMemory.create>[0]["data"]["type"],
              importance: mem.importance as Parameters<typeof prisma.personMemory.create>[0]["data"]["importance"],
              source: "CAPTURE",
            },
          });
        }

        // Create PersonInteraction if present
        if (payload.interaction) {
          const ia = payload.interaction;
          await prisma.personInteraction.create({
            data: {
              userId,
              personId: person.id,
              personNameSnapshot: payload.personName,
              date: ia.date ?? new Date().toISOString().split("T")[0]!,
              location: ia.location ?? null,
              summary: ia.summary,
              topics: ia.topics,
              context: ia.context ?? null,
              sentiment: ia.sentiment ?? null,
              followUpNeeded: ia.followUpNeeded,
              followUpDate: ia.followUpDate ?? null,
            },
          });
        }

        // Create follow-up Task if present
        if (payload.followUpTask) {
          const ft = payload.followUpTask;
          await prisma.task.create({
            data: {
              userId,
              title: ft.title,
              priority: "MEDIUM",
              dueDate: ft.dueDate ? new Date(ft.dueDate + "T00:00:00.000Z") : null,
              importance: "MEDIUM",
              urgency: "MEDIUM",
              energyRequired: "LOW",
            },
          });
          await prisma.followUp.create({
            data: {
              userId,
              title: ft.title,
              type: "PERSON",
              dueDate: ft.dueDate ? new Date(ft.dueDate + "T00:00:00.000Z") : null,
              reason: `Follow up with ${payload.personName}.`,
              createdFrom: "PERSON_CAPTURE",
            },
          });
          result.followUpsCreated++;
        }

        // Create PersonInsight entries
        for (const ins of payload.insights) {
          await prisma.personInsight.create({
            data: {
              userId,
              personId: person.id,
              type: ins.type as Parameters<typeof prisma.personInsight.create>[0]["data"]["type"],
              title: ins.title,
              content: ins.content,
              confidence: ins.confidence as Parameters<typeof prisma.personInsight.create>[0]["data"]["confidence"],
              evidence: ins.evidence,
            },
          });
          result.insightsSaved++;
        }

        result.peopleUpdated++;
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

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
