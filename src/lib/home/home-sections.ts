// Section registry — defines every renderable unit's visibility rules and mode scores.
// Higher score = rendered earlier. Score of 0 = hidden in that mode.

import type { SectionDefinition, HomeMode } from "./home-types";

// Convenience: all modes
const ALL_MODES: HomeMode[] = ["morning", "focus", "preparation", "active", "reflection", "recovery"];

export const SECTION_REGISTRY: SectionDefinition[] = [
  {
    id: "greeting",
    supportedModes: ALL_MODES,
    modeScores: { morning: 10, focus: 10, preparation: 10, active: 10, reflection: 10, recovery: 10 },
    isVisible: () => true, // always shown
  },
  {
    id: "context",
    supportedModes: ALL_MODES,
    modeScores: { morning: 8, focus: 4, preparation: 7, active: 8, reflection: 5, recovery: 6 },
    isVisible: (ctx) => ctx.hasContextChips,
  },
  {
    id: "capture",
    supportedModes: ALL_MODES,
    modeScores: { morning: 7, focus: 10, preparation: 5, active: 9, reflection: 5, recovery: 4 },
    isVisible: () => true, // always shown
  },
  {
    id: "right_now",
    supportedModes: ["morning", "focus", "preparation", "active"],
    modeScores: { morning: 9, focus: 9, preparation: 3, active: 8 },
    isVisible: (ctx) => ctx.hasTopTask || ctx.hasHabitsDue || ctx.hasDueLearning,
  },
  {
    id: "getting_ready",
    supportedModes: ["morning", "preparation", "active", "reflection"],
    modeScores: { morning: 3, preparation: 10, active: 5, reflection: 3 },
    isVisible: (ctx) => ctx.hasReadinessPlans,
  },
  {
    id: "todays_schedule",
    supportedModes: ["morning", "active"],
    modeScores: { morning: 8, active: 3 },
    isVisible: (ctx) => ctx.hasTodayEvents,
  },
  {
    id: "one_question",
    supportedModes: ["morning", "active", "reflection"],
    modeScores: { morning: 5, active: 4, reflection: 8 },
    isVisible: (ctx) => ctx.hasQuestion,
  },
  {
    id: "reflection_prompt",
    supportedModes: ["reflection"],
    modeScores: { reflection: 10 },
    isVisible: (ctx) => ctx.mode === "reflection",
  },
  {
    id: "life_feed",
    supportedModes: ["active", "reflection"],
    modeScores: { active: 3, reflection: 7 },
    isVisible: (ctx) => ctx.hasLifeFeed,
  },
  {
    id: "recovery_guide",
    supportedModes: ["recovery"],
    modeScores: { recovery: 10 },
    isVisible: (ctx) => ctx.recoveryMode,
  },
];
