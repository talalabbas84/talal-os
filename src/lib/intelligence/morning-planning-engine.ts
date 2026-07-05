import { prisma } from "@/lib/prisma";
import type { TaskWithProject } from "@/types";
import type { FollowUpType, GrowthCategory, Level } from "@prisma/client";

export interface DailyPlan {
  date: Date;
  summary: string;
  todayMission: string;
  topThreeTaskIds: string[];
  recommendedHabits: string[];
  peopleToFollowUp: string[];
  ideasToIgnore: string[];
  focusMode: string | null;
  recoveryMode: boolean;
  generatedAt: Date;
  topTasks: TaskWithProject[];
  habitsDue: Array<{ id: string; name: string }>;
  journalFilled: boolean;
  overdueCount: number;
  suggestion: string;
  followUps: FollowUpSummary[];
  todaysQuestions: TodayQuestion[];
  inboxCount: number;
  recentReflection: {
    feeling: string | null;
    accomplished: string | null;
    distracted: string | null;
    improve: string | null;
    date: Date;
  } | null;
}

export interface FollowUpSummary {
  id: string;
  title: string;
  type: FollowUpType;
  dueDate: Date | null;
  reason: string | null;
}

export interface TodayQuestion {
  id: string;
  category: GrowthCategory;
  question: string;
  reason: string | null;
  priority: Level;
}

interface MorningPlanningOptions {
  persist: boolean;
}

export async function buildMorningPlan(
  userId: string,
  options: MorningPlanningOptions = { persist: false },
): Promise<DailyPlan> {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);

  const [
    existingPlan,
    userState,
    memories,
    projects,
    openTasks,
    habits,
    recentCaptures,
    openFollowUps,
    todaysQuestions,
    personInteractions,
    todayLog,
    recentLog,
    overdueCount,
    inboxCount,
  ] = await Promise.all([
    prisma.dailyPlan.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.userState.findUnique({ where: { userId } }),
    prisma.memoryEntry.findMany({
      where: { userId, importance: { in: ["HIGH", "PERMANENT"] } },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.project.findMany({
      where: { userId, status: "ACTIVE" },
      include: { _count: { select: { tasks: true } } },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.task.findMany({
      where: { userId, status: { not: "DONE" } },
      include: { project: true },
      orderBy: [
        { priorityScore: { sort: "desc", nulls: "last" } },
        { dueDate: { sort: "asc", nulls: "last" } },
        { updatedAt: "desc" },
      ],
      take: 25,
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: { completions: { where: { date: today } } },
      orderBy: { name: "asc" },
    }),
    prisma.inboxEntry.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.followUp.findMany({
      where: {
        userId,
        status: "OPEN",
        OR: [{ dueDate: null }, { dueDate: { lte: nextWeek } }],
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.followUpQuestion.findMany({
      where: { userId, status: "OPEN" },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 3,
    }),
    prisma.personInteraction.findMany({
      where: { userId, followUpNeeded: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.dailyLog.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.dailyLog.findFirst({ where: { userId }, orderBy: { date: "desc" } }),
    prisma.task.count({
      where: {
        userId,
        status: { not: "DONE" },
        dueDate: { lt: today },
      },
    }),
    prisma.inboxEntry.count({ where: { userId, status: "PENDING" } }),
  ]);

  const topTasks = selectTopThree(openTasks, today, tomorrow);
  const habitsDue = habits
    .filter((habit) => habit.completions.length === 0)
    .map((habit) => ({ id: habit.id, name: habit.name }));
  const recommendedHabits = habitsDue.slice(0, 3).map((habit) => habit.name);
  const peopleToFollowUp = buildPeopleFollowUps(openFollowUps, personInteractions);
  const ideasToIgnore = buildIdeasToIgnore(recentCaptures, topTasks.length);
  const journalFilled = hasDailyLogContent(todayLog);
  const recoveryMode = Boolean(userState?.recoveryMode || userState?.energyLevel === "LOW");
  const todayMission = buildTodayMission(topTasks, userState?.currentMission);
  const focusMode = buildFocusMode(recoveryMode, overdueCount, topTasks[0]?.project?.name);
  const summary = buildCompanionSummary({
    todayMission,
    topTaskCount: topTasks.length,
    habitsDueCount: habitsDue.length,
    peopleCount: peopleToFollowUp.length,
    inboxCount,
    memoryHint: memories[0]?.title,
    projectHint: projects[0]?.name,
    recoveryMode,
  });
  const suggestion = buildSuggestion(overdueCount, habitsDue.length, topTasks[0]?.title);

  const planData = {
    date: today,
    summary,
    todayMission,
    topThreeTaskIds: topTasks.map((task) => task.id),
    recommendedHabits,
    peopleToFollowUp,
    ideasToIgnore,
    focusMode,
    recoveryMode,
    generatedAt: new Date(),
  };

  const savedPlan =
    options.persist || existingPlan
      ? await prisma.dailyPlan.upsert({
          where: { userId_date: { userId, date: today } },
          create: { ...planData, userId },
          update: planData,
        })
      : null;

  if (options.persist) {
    await prisma.userState.upsert({
      where: { userId },
      create: {
        userId,
        currentMission: todayMission,
        recoveryMode,
        lastPlanning: new Date(),
      },
      update: {
        currentMission: todayMission,
        recoveryMode,
        lastPlanning: new Date(),
      },
    });
  }

  const sourcePlan = savedPlan ?? existingPlan ?? planData;

  return {
    date: sourcePlan.date,
    summary: sourcePlan.summary,
    todayMission: sourcePlan.todayMission,
    topThreeTaskIds: sourcePlan.topThreeTaskIds,
    recommendedHabits: sourcePlan.recommendedHabits,
    peopleToFollowUp: sourcePlan.peopleToFollowUp,
    ideasToIgnore: sourcePlan.ideasToIgnore,
    focusMode: sourcePlan.focusMode,
    recoveryMode: sourcePlan.recoveryMode,
    generatedAt: sourcePlan.generatedAt,
    topTasks,
    habitsDue,
    journalFilled,
    overdueCount,
    suggestion,
    followUps: openFollowUps.map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      type: followUp.type,
      dueDate: followUp.dueDate,
      reason: followUp.reason,
    })),
    todaysQuestions: todaysQuestions.map((question) => ({
      id: question.id,
      category: question.category,
      question: question.question,
      reason: question.reason,
      priority: question.priority,
    })),
    inboxCount,
    recentReflection: recentLog
      ? {
          feeling: recentLog.feeling,
          accomplished: recentLog.accomplished,
          distracted: recentLog.distracted,
          improve: recentLog.improve,
          date: recentLog.date,
        }
      : null,
  };
}

export async function generateMorningPlan(userId: string): Promise<DailyPlan> {
  return buildMorningPlan(userId, { persist: true });
}

function selectTopThree(tasks: TaskWithProject[], today: Date, tomorrow: Date): TaskWithProject[] {
  const urgentPool = tasks.filter((task) => {
    const due = task.dueDate;
    return (
      (due && due < tomorrow) ||
      task.urgency === "HIGH" ||
      task.importance === "HIGH" ||
      task.priority === "URGENT" ||
      task.priority === "HIGH"
    );
  });

  const pool = urgentPool.length >= 3 ? urgentPool : tasks;

  return [...pool]
    .sort((a, b) => scoreTask(b, today) - scoreTask(a, today))
    .slice(0, 3);
}

function scoreTask(task: TaskWithProject, today: Date): number {
  let score = task.priorityScore ?? 0;
  score += levelScore(task.urgency) * 3;
  score += levelScore(task.importance) * 2;
  score += priorityScore(task.priority);
  if (task.dueDate) {
    const daysUntilDue = Math.floor((startOfDay(task.dueDate).getTime() - today.getTime()) / 86_400_000);
    if (daysUntilDue < 0) score += 10;
    else if (daysUntilDue === 0) score += 8;
    else if (daysUntilDue === 1) score += 4;
  }
  return score;
}

function buildPeopleFollowUps(
  followUps: Array<{ title: string; type: FollowUpType }>,
  interactions: Array<{ personNameSnapshot: string; followUpDate: string | null; summary: string }>,
): string[] {
  const items = [
    ...followUps
      .filter((followUp) => followUp.type === "PERSON")
      .map((followUp) => followUp.title),
    ...interactions.map((interaction) =>
      interaction.followUpDate
        ? `${interaction.personNameSnapshot}: ${interaction.summary} (${interaction.followUpDate})`
        : `${interaction.personNameSnapshot}: ${interaction.summary}`,
    ),
  ];

  return [...new Set(items)].slice(0, 5);
}

function buildIdeasToIgnore(
  recentCaptures: Array<{ title: string; category: string | null }>,
  topTaskCount: number,
): string[] {
  if (topTaskCount === 0) return [];

  return recentCaptures
    .filter((entry) => entry.category === "IDEA" || entry.category === null)
    .slice(0, 3)
    .map((entry) => entry.title);
}

function hasDailyLogContent(
  log: { feeling: string | null; accomplished: string | null; distracted: string | null; improve: string | null } | null,
): boolean {
  return Boolean(log && (log.feeling || log.accomplished || log.distracted || log.improve));
}

function buildTodayMission(topTasks: TaskWithProject[], currentMission?: string | null): string {
  if (currentMission) return currentMission;
  if (topTasks[0]) return `Move the day forward by finishing: ${topTasks[0].title}.`;
  return "Keep the day light: capture what matters, handle the next obvious action, and protect energy.";
}

function buildFocusMode(recoveryMode: boolean, overdueCount: number, projectName?: string): string {
  if (recoveryMode) return "Recovery";
  if (overdueCount >= 3) return "Backlog clearing";
  if (projectName) return `Deep work: ${projectName}`;
  return "Normal execution";
}

function buildCompanionSummary(input: {
  todayMission: string;
  topTaskCount: number;
  habitsDueCount: number;
  peopleCount: number;
  inboxCount: number;
  memoryHint?: string;
  projectHint?: string;
  recoveryMode: boolean;
}): string {
  const mode = input.recoveryMode ? "Keep today smaller than usual." : "Keep the day focused.";
  const extras = [
    input.topTaskCount ? `${input.topTaskCount} priority task${input.topTaskCount !== 1 ? "s" : ""}` : "no urgent tasks",
    input.habitsDueCount ? `${input.habitsDueCount} habit${input.habitsDueCount !== 1 ? "s" : ""}` : "habits clear",
    input.peopleCount ? `${input.peopleCount} people follow-up${input.peopleCount !== 1 ? "s" : ""}` : "no people follow-ups",
    `${input.inboxCount} inbox item${input.inboxCount !== 1 ? "s" : ""}`,
  ];

  const context = input.projectHint
    ? `Main project context: ${input.projectHint}.`
    : input.memoryHint
      ? `Relevant memory: ${input.memoryHint}.`
      : "No major context is blocking today.";

  return `${mode} ${input.todayMission} ${extras.join(", ")}. ${context}`;
}

function buildSuggestion(overdue: number, habitsPending: number, topTaskTitle?: string): string {
  if (overdue >= 3) return `${overdue} tasks overdue. Clear the backlog first.`;
  if (overdue > 0 && habitsPending > 0) {
    return `${overdue} task${overdue > 1 ? "s" : ""} overdue, ${habitsPending} habit${habitsPending > 1 ? "s" : ""} pending.`;
  }
  if (overdue > 0) return overdue === 1 ? "1 task overdue — clear it, then move forward." : `${overdue} tasks overdue. Clear those first.`;
  if (topTaskTitle) return `Focus: ${topTaskTitle}.`;
  if (habitsPending > 0) return `${habitsPending} habit${habitsPending > 1 ? "s" : ""} to complete today.`;
  return "All clear today.";
}

function levelScore(level: "LOW" | "MEDIUM" | "HIGH"): number {
  if (level === "HIGH") return 3;
  if (level === "MEDIUM") return 2;
  return 1;
}

function priorityScore(priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"): number {
  if (priority === "URGENT") return 8;
  if (priority === "HIGH") return 5;
  if (priority === "MEDIUM") return 2;
  return 0;
}

function startOfToday(): Date {
  return startOfDay(new Date());
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}
