import type { SectionId } from "@/lib/home/home-types";

// LifeStateType mirrors the Prisma enum — 11 states
export type LifeStateType =
  | "DEFAULT"
  | "MORNING"
  | "FOCUS"
  | "BREAK"
  | "PREPARATION"
  | "ACTIVE_EVENT"
  | "REFLECTION"
  | "LEARNING"
  | "RECOVERY"
  | "SOCIAL"
  | "CEO_REVIEW";

// All signals the detector uses — no DB calls, pure computation
export interface LifeStateContext {
  now: Date;
  hour: number;
  isoDate: string;
  isWeekend: boolean;
  recoveryMode: boolean;
  isInFocusSession: boolean;
  currentActivityCategory: string | null;
  currentActivityTitle: string | null;
  lastActivityAge: number | null;        // minutes since last activity
  hasUpcomingEventSoon: boolean;         // event within 3h
  hasActiveEvent: boolean;               // event started within 2h, still ongoing
  activeEventTitle: string | null;
  nextEventTitle: string | null;
  nextEventHoursAway: number | null;
  hasDueLearning: boolean;
  currentLifeState: LifeStateType;       // persisted state from DB
  lifeStateAge: number;                  // minutes since current state was entered
}

export interface LifeStateTransition {
  from: LifeStateType;
  to: LifeStateType;
  triggeredBy: "auto" | "capture" | "event" | "manual";
  enteredAt: Date;
  exitedAt: Date;
}

export interface LifeLayout {
  state: LifeStateType;
  stateLabel: string;
  sections: SectionId[];
}

export const LIFE_STATE_LABELS: Record<LifeStateType, string> = {
  DEFAULT:      "Default",
  MORNING:      "Morning",
  FOCUS:        "Focus",
  BREAK:        "Break",
  PREPARATION:  "Preparing",
  ACTIVE_EVENT: "In Event",
  REFLECTION:   "Reflection",
  LEARNING:     "Learning",
  RECOVERY:     "Recovery",
  SOCIAL:       "Social",
  CEO_REVIEW:   "CEO Review",
};
