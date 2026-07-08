// Public API for the Life State Engine — import this, not the sub-modules directly.

export { getActiveLifeState, transitionState, manualTransition } from "./life-state-manager";
export { getStateLayout } from "./life-state-router";
export { getStateHistory, getCurrentStateRecord } from "./life-state-history";
export { detectLifeState } from "./life-state-detector";
export type {
  LifeStateType,
  LifeStateContext,
  LifeStateTransition,
  LifeLayout,
} from "./life-state-types";
export { LIFE_STATE_LABELS } from "./life-state-types";
export type { RoutingContext } from "./life-state-router";
