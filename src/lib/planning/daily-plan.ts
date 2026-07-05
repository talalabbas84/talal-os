import { prisma } from "@/lib/prisma";
import type { TaskWithProject } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DailyPlan {
  topTasks: TaskWithProject[];
  habitsDue: Array<{ id: string; name: string }>;
  journalFilled: boolean;
  overdueCount: number;
  suggestion: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export async function buildDailyPlan(userId: string): Promise<DailyPlan> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [topTasks, habits, dailyLog, overdueCount] = await Promise.all([
    // Top priority tasks — due today OR high urgency/importance, sorted by score
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "DONE" },
        OR: [
          { dueDate: { gte: today, lt: tomorrow } },
          { urgency: "HIGH" },
          { importance: "HIGH" },
        ],
      },
      orderBy: [
        { priorityScore: { sort: "desc", nulls: "last" } },
        { dueDate: { sort: "asc", nulls: "last" } },
      ],
      take: 3,
      include: { project: true },
    }),

    // Active habits with today's completions
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: {
        completions: { where: { date: today } },
      },
      orderBy: { name: "asc" },
    }),

    // Today's daily log (if any)
    prisma.dailyLog.findUnique({
      where: { userId_date: { userId, date: today } },
    }),

    // Count of overdue tasks
    prisma.task.count({
      where: {
        userId,
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
  ]);

  const habitsDue = habits
    .filter((h) => h.completions.length === 0)
    .map((h) => ({ id: h.id, name: h.name }));

  const journalFilled = !!(
    dailyLog &&
    (dailyLog.feeling || dailyLog.accomplished || dailyLog.distracted || dailyLog.improve)
  );

  const suggestion = buildSuggestion(overdueCount, habitsDue.length, topTasks[0]?.title);

  return { topTasks, habitsDue, journalFilled, overdueCount, suggestion };
}

// ── Suggestion generator ──────────────────────────────────────────────────────

function buildSuggestion(
  overdue: number,
  habitsPending: number,
  topTaskTitle?: string,
): string {
  if (overdue >= 3) {
    return `${overdue} tasks overdue. Clear the backlog first.`;
  }
  if (overdue > 0 && habitsPending > 0) {
    return `${overdue} task${overdue > 1 ? "s" : ""} overdue, ${habitsPending} habit${habitsPending > 1 ? "s" : ""} pending.`;
  }
  if (overdue > 0) {
    return overdue === 1
      ? "1 task overdue — clear it, then move forward."
      : `${overdue} tasks overdue. Clear those first.`;
  }
  if (topTaskTitle) {
    return `Focus: ${topTaskTitle}.`;
  }
  if (habitsPending > 0) {
    return `${habitsPending} habit${habitsPending > 1 ? "s" : ""} to complete today.`;
  }
  return "All clear today.";
}
