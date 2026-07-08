import type { NeedType } from "./need-types";
import type { LifeStateType } from "@/lib/life-state/life-state-types";

const NEED_TO_LIFE_STATE: Partial<Record<NeedType, LifeStateType>> = {
  HEALTH:       "RECOVERY",
  RECOVERY:     "RECOVERY",
  SUPPORT:      "RECOVERY",
  PLANNING:     "MORNING",
  PRODUCTIVITY: "FOCUS",
  PREPARING:    "PREPARATION",
  REFLECTING:   "REFLECTION",
  LEARNING:     "LEARNING",
  SOCIAL:       "SOCIAL",
};

export function needToLifeState(primaryNeed: NeedType): LifeStateType | null {
  return NEED_TO_LIFE_STATE[primaryNeed] ?? null;
}
