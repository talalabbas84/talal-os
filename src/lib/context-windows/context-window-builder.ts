import { buildScheduledFor } from "@/lib/readiness/readiness-builder";
import type { LifeStateType } from "@/lib/life-state/life-state-types";
import type { WindowFrame } from "./context-window-types";

// ActivityLog.category → previous window category key
const ACTIVITY_CATEGORY: Record<string, string> = {
  DANCE: "dance",
  FITNESS: "workout",
  WORK: "work",
  TALAL_OS: "work",
  SOCIAL: "social",
  LEARNING: "learning",
  FOOD: "food",
  REST: "rest",
  RECOVERY: "recovery",
  PROCRASTINATION: "other",
  ERRAND: "other",
  OTHER: "other",
};

// ActivityLog.category → human-readable past-tense label
const ACTIVITY_PAST: Record<string, string> = {
  DANCE: "Finished dance class",
  FITNESS: "Finished workout",
  WORK: "Finished a work session",
  TALAL_OS: "Finished a Talal OS session",
  SOCIAL: "Wrapped up social time",
  LEARNING: "Finished a learning session",
  FOOD: "Finished eating",
  REST: "Finished resting",
  RECOVERY: "Done recovering",
  PROCRASTINATION: "Finished procrastinating",
  ERRAND: "Finished an errand",
  OTHER: "Just finished something",
};

// ActivityLog type (minimal — only what we query)
interface ActivityEntry {
  id: string;
  activity: string;
  category: string;
  createdAt: Date;
}

// EventPlaceholder type (minimal)
interface EventEntry {
  id: string;
  title: string;
  time: string | null;
  date: Date;
}

// Task type (minimal)
interface TaskEntry {
  id: string;
  title: string;
  priority: string;
  dueDate?: Date | null;
}

// ReadinessPlan type (minimal — from Prisma)
interface ReadinessPlanEntry {
  id: string;
  title: string;
  entityId: string | null;
  scheduledFor: Date;
}

export interface NextWindowResult {
  frame: WindowFrame | null;
  linkedPersonId: string | null;
  scheduledAt: Date | null;
}

// ── Previous Window ───────────────────────────────────────────────────────────
// What just happened? Most recent activity in the last 4 hours wins.
// Fallback: past event today.

export function buildPreviousWindow(
  recentActivities: ActivityEntry[],
  todayEvents: EventEntry[],
  now: Date,
): WindowFrame | null {
  const latest = recentActivities[0];
  if (latest) {
    const label = ACTIVITY_PAST[latest.category] ?? `Finished ${latest.activity.toLowerCase()}`;
    return {
      summary: label,
      category: ACTIVITY_CATEGORY[latest.category] ?? "other",
      entityType: "activity",
      entityId: latest.id,
    };
  }

  // Check events that have a time in the past (> 30 min ago)
  for (const ev of [...todayEvents].reverse()) {
    if (!ev.time) continue;
    const dt = buildScheduledFor(ev.date, ev.time);
    const minAgo = (now.getTime() - dt.getTime()) / 60_000;
    if (minAgo > 30 && minAgo < 240) {
      return {
        summary: `${ev.title} finished`,
        category: detectEventCategory(ev.title),
        entityType: "event",
        entityId: ev.id,
      };
    }
  }

  return null;
}

// ── Current Window ────────────────────────────────────────────────────────────
// What is Talal doing right now? Derived from the persisted LifeStateType.

const CURRENT_SUMMARIES: Record<LifeStateType, string> = {
  FOCUS:        "In a focus session",
  BREAK:        "On a break",
  ACTIVE_EVENT: "In an event",
  SOCIAL:       "Socializing",
  LEARNING:     "In a learning session",
  PREPARATION:  "Preparing",
  RECOVERY:     "Recovering",
  MORNING:      "Starting the morning",
  REFLECTION:   "Winding down",
  DEFAULT:      "Between activities",
  CEO_REVIEW:   "Reviewing the week",
};

export function buildCurrentWindow(
  lifeState: LifeStateType,
  currentActivityName: string | null,
): WindowFrame {
  let summary = CURRENT_SUMMARIES[lifeState] ?? "Between activities";

  if (lifeState === "FOCUS" && currentActivityName) {
    summary = `Working on ${currentActivityName.toLowerCase()}`;
  }

  return {
    summary,
    category: lifeState.toLowerCase(),
  };
}

// ── Next Window ───────────────────────────────────────────────────────────────
// What's coming next? Priority: ReadinessPlan > future event today > tomorrow > task.

export function buildNextWindow(
  todayEvents: (EventEntry & { relatedPersonId?: string | null })[],
  tomorrowEvents: (EventEntry & { relatedPersonId?: string | null })[],
  readinessPlans: ReadinessPlanEntry[],
  topTask: TaskEntry | null,
  now: Date,
): NextWindowResult {
  // ReadinessPlan has full datetime — most reliable
  const plan = readinessPlans[0];
  if (plan) {
    const linkedEvent = todayEvents.find((e) => e.id === plan.entityId);
    return {
      frame: {
        summary: plan.title,
        category: detectEventCategory(plan.title),
        entityType: "event",
        entityId: plan.entityId ?? undefined,
      },
      linkedPersonId: linkedEvent?.relatedPersonId ?? null,
      scheduledAt: plan.scheduledFor,
    };
  }

  // Future event today (has a time that hasn't passed yet)
  for (const ev of todayEvents) {
    if (!ev.time) continue;
    const dt = buildScheduledFor(ev.date, ev.time);
    if (dt > now) {
      return {
        frame: {
          summary: `${ev.title} at ${ev.time}`,
          category: detectEventCategory(ev.title),
          entityType: "event",
          entityId: ev.id,
        },
        linkedPersonId: ev.relatedPersonId ?? null,
        scheduledAt: dt,
      };
    }
  }

  // Today events without time (any time today)
  const anyTodayEvent = todayEvents.find((e) => !e.time);
  if (anyTodayEvent) {
    return {
      frame: {
        summary: anyTodayEvent.title,
        category: detectEventCategory(anyTodayEvent.title),
        entityType: "event",
        entityId: anyTodayEvent.id,
      },
      linkedPersonId: anyTodayEvent.relatedPersonId ?? null,
      scheduledAt: null,
    };
  }

  // Tomorrow's first event
  const tomorrowEvent = tomorrowEvents[0];
  if (tomorrowEvent) {
    return {
      frame: {
        summary: tomorrowEvent.time
          ? `${tomorrowEvent.title} tomorrow at ${tomorrowEvent.time}`
          : `${tomorrowEvent.title} tomorrow`,
        category: detectEventCategory(tomorrowEvent.title),
        entityType: "event",
        entityId: tomorrowEvent.id,
      },
      linkedPersonId: tomorrowEvent.relatedPersonId ?? null,
      scheduledAt: tomorrowEvent.time
        ? buildScheduledFor(tomorrowEvent.date, tomorrowEvent.time)
        : null,
    };
  }

  // Top task fallback
  if (topTask) {
    return {
      frame: {
        summary: topTask.title,
        category: "work_task",
        entityType: "task",
        entityId: topTask.id,
      },
      linkedPersonId: null,
      scheduledAt: topTask.dueDate ?? null,
    };
  }

  return { frame: null, linkedPersonId: null, scheduledAt: null };
}

// ── Category Detection ────────────────────────────────────────────────────────

export function detectEventCategory(title: string): string {
  const t = title.toLowerCase();
  if (/dinner|lunch|brunch|drinks|coffee|date|party|hang|social/.test(t)) return "social_event";
  if (/dance|ballet|salsa|bachata|tango|class/.test(t)) return "dance_class";
  if (/gym|workout|fitness|run|jog|swim|yoga|lift|train/.test(t)) return "workout";
  if (/meeting|call|review|check.in|interview|standup/.test(t)) return "work_task";
  if (/sleep|bed|night/.test(t)) return "sleep";
  if (/learn|study|read|review/.test(t)) return "learning_review";
  return "other";
}
