import type { LifeStateContext, LifeStateType } from "./life-state-types";

// Pure function — detects life state from context signals, no DB access.
//
// Sticky-state rules:
//   RECOVERY     — stays while recoveryMode is true; only dismissed manually
//   FOCUS        — stays up to 45 min after last WORK/TALAL_OS activity
//   BREAK        — lingers 15 min after focus session ends
//   ACTIVE_EVENT — stays while hasActiveEvent is true; exits to REFLECTION
export function detectLifeState(ctx: LifeStateContext): LifeStateType {
  const {
    currentLifeState: persisted, lifeStateAge,
    recoveryMode, isInFocusSession,
    currentActivityCategory, lastActivityAge,
    hasActiveEvent, hasUpcomingEventSoon,
    hour,
  } = ctx;

  // RECOVERY is always highest priority
  if (recoveryMode) return "RECOVERY";

  // FOCUS stickiness
  if (persisted === "FOCUS") {
    const focusActivityActive = (lastActivityAge ?? 999) < 45 &&
      (currentActivityCategory === "WORK" || currentActivityCategory === "TALAL_OS");
    if (focusActivityActive) return "FOCUS";
    // Focus just ended → transition to BREAK for 15 min
    if (lifeStateAge < 15) return "BREAK";
  }

  // BREAK stickiness (entered from FOCUS ending)
  if (persisted === "BREAK" && lifeStateAge < 15) return "BREAK";

  // New FOCUS session started
  if (isInFocusSession) return "FOCUS";

  // ACTIVE_EVENT: ongoing event (started < 2h ago)
  if (persisted === "ACTIVE_EVENT") {
    if (hasActiveEvent) return "ACTIVE_EVENT";
    return "REFLECTION"; // event just ended
  }
  if (hasActiveEvent) return "ACTIVE_EVENT";

  // PREPARATION: event within 3h
  if (hasUpcomingEventSoon) return "PREPARATION";

  // SOCIAL: recent SOCIAL category activity
  if (currentActivityCategory === "SOCIAL" && (lastActivityAge ?? 999) < 30) return "SOCIAL";

  // LEARNING: recent LEARNING category activity
  if (currentActivityCategory === "LEARNING" && (lastActivityAge ?? 999) < 30) return "LEARNING";

  // REFLECTION: evening or late afternoon with no upcoming events
  if (hour >= 20) return "REFLECTION";
  if (hour >= 18 && !hasUpcomingEventSoon) return "REFLECTION";

  // MORNING: 5–12
  if (hour >= 5 && hour < 12) return "MORNING";

  return "DEFAULT";
}
