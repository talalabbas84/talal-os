import { prisma } from "@/lib/prisma";
import { getTemporalContext } from "./temporal-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HabitContext {
  id: string;
  name: string;
  completedToday: boolean;
}

export interface TaskContext {
  id: string;
  title: string;
  dueDate: Date | null;
  urgency: string;
  status: string;
  project: string | null;
}

export interface UserContext {
  projects: Array<{ id: string; name: string; openTaskCount: number }>;
  openTasks: TaskContext[];
  overdueTasks: TaskContext[];
  todayTasks: TaskContext[];
  tomorrowTasks: TaskContext[];
  habits: HabitContext[];
  latestDailyLog: { feeling: string | null; accomplished: string | null } | null;
  recentIdeas: Array<{ id: string; title: string }>;
  recentMemories: Array<{ id: string; title: string; type: string; importance: string }>;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export async function buildUserContext(userId: string, timezone = "America/Toronto"): Promise<{
  raw: UserContext;
  prompt: string;
}> {
  const temporal = getTemporalContext(timezone);
  const today = temporal.todayMidnight;
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  const dayAfter = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 2));

  const [projects, tasks, habits, latestLog, recentIdeas, recentMemories] =
    await Promise.all([
      prisma.project.findMany({
        where: { userId, status: "ACTIVE" },
        include: {
          _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),

      prisma.task.findMany({
        where: { userId, status: { not: "DONE" } },
        orderBy: [
          { priorityScore: { sort: "desc", nulls: "last" } },
          { dueDate: { sort: "asc", nulls: "last" } },
        ],
        take: 15,
        include: { project: { select: { name: true } } },
      }),

      prisma.habit.findMany({
        where: { userId, isActive: true },
        include: {
          completions: { where: { date: today } },
        },
        orderBy: { name: "asc" },
      }),

      prisma.dailyLog.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
      }),

      prisma.inboxEntry.findMany({
        where: { userId, status: "PENDING", category: "IDEA" },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      prisma.memoryEntry.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
      }),
    ]);

  const toContext = (t: typeof tasks[number]): TaskContext => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    urgency: t.urgency as string,
    status: t.status,
    project: t.project?.name ?? null,
  });

  const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today).map(toContext);
  const todayTasks = tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow).map(toContext);
  const tomorrowTasks = tasks.filter((t) => t.dueDate && t.dueDate >= tomorrow && t.dueDate < dayAfter).map(toContext);

  const raw: UserContext = {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      openTaskCount: p._count.tasks,
    })),
    openTasks: tasks.map(toContext),
    overdueTasks,
    todayTasks,
    tomorrowTasks,
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      completedToday: h.completions.length > 0,
    })),
    latestDailyLog: latestLog
      ? { feeling: latestLog.feeling, accomplished: latestLog.accomplished }
      : null,
    recentIdeas: recentIdeas.map((e) => ({ id: e.id, title: e.title })),
    recentMemories: recentMemories.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      importance: m.importance,
    })),
  };

  return { raw, prompt: buildContextPrompt(raw, today, temporal.prompt) };
}

// ── Prompt formatter ──────────────────────────────────────────────────────────

function buildContextPrompt(ctx: UserContext, today: Date, temporalPrompt: string): string {
  const lines: string[] = [];
  lines.push(temporalPrompt);

  if (ctx.projects.length > 0) {
    const ps = ctx.projects
      .map((p) => `${p.name} (${p.openTaskCount} open)`)
      .join(" | ");
    lines.push(`\nPROJECTS: ${ps}`);
  }

  if (ctx.openTasks.length > 0) {
    lines.push(`\nOPEN TASKS (${ctx.openTasks.length} total — use these for command matching):`);
    const shown = ctx.openTasks.slice(0, 10);
    for (const t of shown) {
      const parts = [`• ${t.title}`];
      if (t.urgency === "HIGH") parts.push("[HIGH urgency]");
      if (t.dueDate) parts.push(`[due ${formatDue(t.dueDate, today)}]`);
      if (t.project) parts.push(`[${t.project}]`);
      lines.push(parts.join(" "));
    }
    if (ctx.openTasks.length > 10) {
      lines.push(`  (+ ${ctx.openTasks.length - 10} more)`);
    }
  }

  if (ctx.overdueTasks.length > 0) {
    const os = ctx.overdueTasks
      .slice(0, 4)
      .map((t) => `• ${t.title}`)
      .join("\n");
    lines.push(`\nOVERDUE (${ctx.overdueTasks.length}):\n${os}`);
  }

  if (ctx.habits.length > 0) {
    const hs = ctx.habits
      .map((h) => `${h.name} ${h.completedToday ? "✓" : "⏳"}`)
      .join(" | ");
    lines.push(`\nHABITS TODAY: ${hs}`);
  }

  if (ctx.latestDailyLog) {
    const logParts: string[] = [];
    if (ctx.latestDailyLog.feeling) logParts.push(`Feeling: ${ctx.latestDailyLog.feeling}`);
    if (ctx.latestDailyLog.accomplished) logParts.push(`Done: ${ctx.latestDailyLog.accomplished}`);
    if (logParts.length > 0) lines.push(`\nLAST LOG: ${logParts.join(". ")}`);
  }

  if (ctx.recentIdeas.length > 0) {
    lines.push(`\nINBOX IDEAS: ${ctx.recentIdeas.map((i) => i.title).join("; ")}`);
  }

  if (ctx.recentMemories.length > 0) {
    const ms = ctx.recentMemories
      .map((m) => `"${m.title}" [${m.type}, ${m.importance}]`)
      .join("; ");
    lines.push(`\nMEMORIES: ${ms}`);
  }

  return lines.join("\n");
}

function formatDue(date: Date, today: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
