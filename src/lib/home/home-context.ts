// Builds HomeContext from pre-fetched data.
// Pure computation — no DB calls, no async.

import type { DailyPlan } from "@/lib/intelligence/morning-planning-engine";
import type { UserState, EventPlaceholder, LifeTimelineEntry } from "@prisma/client";
import type { ReadinessPlanData } from "@/lib/readiness/readiness-types";
import type { TemporalContext } from "@/lib/context/temporal-context";
import type { HomeContext, HomeMode } from "./home-types";

interface BuildHomeContextInput {
  plan: DailyPlan;
  userState: UserState | null;
  nextEvents: EventPlaceholder[];
  lifeTimeline: LifeTimelineEntry[];
  readinessPlans: ReadinessPlanData[];
  temporal: TemporalContext & { hour: number };
  hasQuestion: boolean;
  hasContextChips: boolean;
}

export function buildHomeContext(input: BuildHomeContextInput): HomeContext {
  const {
    plan, userState, nextEvents, lifeTimeline,
    readinessPlans, temporal, hasQuestion, hasContextChips,
  } = input;

  const { now, dayOfWeek, isoDate, todayMidnight } = temporal;
  const hour = temporal.hour;
  const isWeekend = dayOfWeek === "Saturday" || dayOfWeek === "Sunday";

  // ── Event signals ──────────────────────────────────────────────────────────
  const todayIso = isoDate;
  const hasTodayEvents = nextEvents.some(
    (ev) => ev.date.toISOString().split("T")[0] === todayIso,
  );

  // Use readiness plans (already have scheduledFor as full DateTime) for time checks
  const soonestPlan = readinessPlans[0];
  const nextEventHoursAway = soonestPlan
    ? (soonestPlan.scheduledFor.getTime() - now.getTime()) / 3_600_000
    : null;
  const hasUpcomingEventSoon = nextEventHoursAway !== null && nextEventHoursAway >= 0 && nextEventHoursAway <= 3;
  const nextEventTitle = soonestPlan?.title ?? nextEvents[0]?.title ?? null;

  // ── Work signals ───────────────────────────────────────────────────────────
  const lastActivity = plan.currentActivity;
  const isInFocusSession =
    !!lastActivity &&
    (lastActivity.category === "WORK" || lastActivity.category === "TALAL_OS") &&
    (now.getTime() - lastActivity.createdAt.getTime()) / 60_000 < 30;
  const currentActivityTitle = isInFocusSession ? lastActivity!.activity : null;

  const hasTopTask = plan.topTasks.length > 0;
  const topTask = plan.topTasks[0];
  const topTaskTitle = topTask?.title ?? null;
  const topTaskProject = topTask?.project?.name ?? null;
  const hasHabitsDue = plan.habitsDue.length > 0;
  const hasDueLearning = plan.dueLearningItems.length > 0;

  // ── State signals ──────────────────────────────────────────────────────────
  const recoveryMode = plan.recoveryMode;
  const hasRecentReflection = !!plan.recentReflection;
  const recentAccomplished = plan.recentReflection?.accomplished ?? null;

  // ── Content availability ───────────────────────────────────────────────────
  const hasReadinessPlans = readinessPlans.length > 0;
  const hasLifeFeed = lifeTimeline.length > 0 || plan.todayActivityLogs.length > 0;

  // ── Mode detection ─────────────────────────────────────────────────────────
  const mode = detectMode({
    hour, recoveryMode, isInFocusSession, hasUpcomingEventSoon,
    userState, nextEvents, isoDate, now,
  });

  return {
    mode,
    hour,
    dayOfWeek,
    isoDate,
    now,
    todayMidnight,
    isWeekend,
    hasTodayEvents,
    hasUpcomingEventSoon,
    nextEventHoursAway,
    nextEventTitle,
    isInFocusSession,
    currentActivityTitle,
    hasTopTask,
    topTaskTitle,
    topTaskProject,
    hasHabitsDue,
    hasDueLearning,
    recoveryMode,
    hasRecentReflection,
    recentAccomplished,
    hasReadinessPlans,
    hasQuestion,
    hasLifeFeed,
    hasContextChips,
  };
}

function detectMode(ctx: {
  hour: number;
  recoveryMode: boolean;
  isInFocusSession: boolean;
  hasUpcomingEventSoon: boolean;
  userState: UserState | null;
  nextEvents: EventPlaceholder[];
  isoDate: string;
  now: Date;
}): HomeMode {
  if (ctx.recoveryMode) return "recovery";
  if (ctx.isInFocusSession) return "focus";
  if (ctx.hasUpcomingEventSoon) return "preparation";

  const isEvening = ctx.hour >= 20 || (ctx.hour >= 18 && !ctx.nextEvents.some(
    (ev) => ev.date.toISOString().split("T")[0] === ctx.isoDate,
  ));
  if (isEvening) return "reflection";

  const isMorning = ctx.hour >= 5 && ctx.hour < 12;
  if (isMorning) return "morning";

  return "active";
}
