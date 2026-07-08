import type { LifeStateType } from "./life-state-types";
import type { SectionId } from "@/lib/home/home-types";

export interface RoutingContext {
  hasTopTask: boolean;
  hasReadinessPlans: boolean;
  hasQuestion: boolean;
  hasLifeFeed: boolean;
  hasTodayEvents: boolean;
  hasContextChips: boolean;
  hasDueLearning: boolean;
}

// Priority-ordered section list per state.
// Sections requiring data are filtered by RoutingContext at runtime.
const STATE_SECTIONS: Record<LifeStateType, SectionId[]> = {
  DEFAULT:      ["greeting", "context", "capture", "right_now", "one_question", "life_feed"],
  MORNING:      ["greeting", "context", "right_now", "todays_schedule", "capture", "one_question"],
  FOCUS:        ["greeting", "right_now", "capture"],
  BREAK:        ["greeting", "break_guide", "capture", "right_now"],
  PREPARATION:  ["greeting", "getting_ready", "capture", "context", "one_question"],
  ACTIVE_EVENT: ["greeting", "capture"],
  REFLECTION:   ["greeting", "reflection_prompt", "one_question", "life_feed", "capture"],
  LEARNING:     ["greeting", "learning_review", "capture", "right_now"],
  RECOVERY:     ["greeting", "recovery_guide", "capture", "context"],
  SOCIAL:       ["greeting", "social_guide", "capture"],
  CEO_REVIEW:   ["greeting", "ceo_review", "context", "capture"],
};

// Sections that only render when matching data is present
const DATA_GUARDS: Partial<Record<SectionId, (ctx: RoutingContext) => boolean>> = {
  right_now:       (ctx) => ctx.hasTopTask,
  getting_ready:   (ctx) => ctx.hasReadinessPlans,
  one_question:    (ctx) => ctx.hasQuestion,
  life_feed:       (ctx) => ctx.hasLifeFeed,
  todays_schedule: (ctx) => ctx.hasTodayEvents,
  context:         (ctx) => ctx.hasContextChips,
  learning_review: (ctx) => ctx.hasDueLearning,
};

export function getStateLayout(state: LifeStateType, ctx: RoutingContext): SectionId[] {
  return STATE_SECTIONS[state].filter((id) => {
    const guard = DATA_GUARDS[id];
    return !guard || guard(ctx);
  });
}
