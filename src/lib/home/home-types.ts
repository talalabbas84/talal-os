// ── Home Mode ─────────────────────────────────────────────────────────────────
// The engine detects one mode per page load. Mode controls ordering + visibility.

export type HomeMode =
  | "morning"       // 6 AM–11 AM — prepare for the day
  | "focus"         // deep work detected — show only what matters now
  | "preparation"   // event within 3 hours — replace dashboard with readiness
  | "active"        // default daytime mode
  | "reflection"    // evening / after important event — wind down and review
  | "recovery";     // illness / burnout / low energy reported

// ── Section IDs ───────────────────────────────────────────────────────────────
// Every renderable unit of the home page has an ID.
// The engine returns an ordered list of IDs; the page renders them in that order.

export type SectionId =
  | "greeting"           // contextual greeting with recent history reference
  | "context"            // context chips (chapter, project, energy, mood, next event)
  | "capture"            // HomeCapture — the primary interaction
  | "right_now"          // single task/habit/learning recommendation
  | "getting_ready"      // ReadinessCard for nearest upcoming event
  | "todays_schedule"    // today's events list (morning + active modes)
  | "one_question"       // single reflection/growth question
  | "reflection_prompt"  // evening "How was your day?" card
  | "life_feed"          // chronological LifeTimeline + ActivityLogs
  | "recovery_guide"     // recovery mode recommendations
  | "break_guide"        // post-focus break suggestions
  | "learning_review"    // learning session: due items + review CTA
  | "social_guide"       // social event tips and presence reminders
  | "ceo_review";        // system-level review: projects, habits, weekly context

// ── Home Context ──────────────────────────────────────────────────────────────
// All signals the engine uses to make decisions.
// Computed from pre-fetched data — no extra DB calls.

export interface HomeContext {
  // Time signals
  mode: HomeMode;
  hour: number;
  dayOfWeek: string;
  isoDate: string;
  now: Date;
  todayMidnight: Date;
  isWeekend: boolean;

  // Event signals
  hasTodayEvents: boolean;
  hasUpcomingEventSoon: boolean;  // event within 3 hours
  nextEventHoursAway: number | null;
  nextEventTitle: string | null;

  // Work signals
  isInFocusSession: boolean;      // recent WORK/TALAL_OS activity (<30 min)
  currentActivityTitle: string | null;
  hasTopTask: boolean;
  topTaskTitle: string | null;
  topTaskProject: string | null;
  hasHabitsDue: boolean;
  hasDueLearning: boolean;

  // State signals
  recoveryMode: boolean;
  hasRecentReflection: boolean;
  recentAccomplished: string | null;

  // Content availability
  hasReadinessPlans: boolean;
  hasQuestion: boolean;
  hasLifeFeed: boolean;
  hasContextChips: boolean;
}

// ── Section Definition ────────────────────────────────────────────────────────

export interface SectionDefinition {
  id: SectionId;
  // Which modes this section can appear in (empty = all modes)
  supportedModes: HomeMode[];
  // Score within each mode — higher = earlier in layout. 0 = hidden in that mode.
  modeScores: Partial<Record<HomeMode, number>>;
  // Extra runtime visibility check (beyond mode score > 0)
  isVisible: (ctx: HomeContext) => boolean;
}

// ── Home Layout ───────────────────────────────────────────────────────────────

export interface HomeLayout {
  mode: HomeMode;
  modeLabel: string;
  sections: SectionId[];  // ordered, filtered, ready to render
}

// ── Section render props ──────────────────────────────────────────────────────
// Passed from page.tsx to the section renderer — all pre-fetched data.

import type { DailyPlan, ActivityLogSummary } from "@/lib/intelligence/morning-planning-engine";
import type { UserState, EventPlaceholder, LifeTimelineEntry } from "@prisma/client";
import type { RightNowItem } from "@/features/dashboard/components/right-now-card";
import type { ReadinessPlanData } from "@/lib/readiness/readiness-types";

export interface SectionData {
  plan: DailyPlan;
  userState: UserState | null;
  nextEvents: EventPlaceholder[];
  lifeTimeline: LifeTimelineEntry[];
  readinessPlans: ReadinessPlanData[];
  rightNow: RightNowItem | null;
  question: { id: string; question: string; reason: string | null } | null;
  contextChips: Array<{ label: string; value: string }>;
  greeting: { headline: string; subline: string; note?: string };
  lifeFeed: Array<{ time: Date; text: string; tag?: string }>;
  temporal: { now: Date; isoDate: string; localTime: string };
  mode: HomeMode;
}
