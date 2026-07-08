import type { NeedType } from "./need-types";
import type { ActionType } from "@/lib/intelligence/types";

export interface NeedActionGuidance {
  preferred: ActionType[];
  discouraged: ActionType[];
}

const GUIDANCE: Record<NeedType, NeedActionGuidance> = {
  SUPPORT:      { preferred: ["UPDATE_USER_STATE", "ENABLE_RECOVERY_MODE", "CREATE_THOUGHT"], discouraged: ["CREATE_TASK", "CREATE_PROJECT"] },
  RECOVERY:     { preferred: ["UPDATE_USER_STATE", "ENABLE_RECOVERY_MODE", "CREATE_ACTIVITY_LOG"], discouraged: ["CREATE_TASK", "CREATE_PROJECT", "CREATE_REMINDER"] },
  HEALTH:       { preferred: ["UPDATE_USER_STATE", "ENABLE_RECOVERY_MODE", "CREATE_THOUGHT"], discouraged: ["CREATE_TASK"] },
  VENTING:      { preferred: ["CREATE_THOUGHT", "CREATE_MEMORY"], discouraged: ["CREATE_TASK", "CREATE_PROJECT"] },
  CELEBRATING:  { preferred: ["CREATE_THOUGHT", "CREATE_TIMELINE_EVENT", "CREATE_ACTIVITY_LOG"], discouraged: [] },
  REMEMBERING:  { preferred: ["CREATE_MEMORY", "CREATE_THOUGHT"], discouraged: [] },
  LEARNING:     { preferred: ["CREATE_LEARNING_ITEM", "CREATE_THOUGHT"], discouraged: [] },
  REFLECTING:   { preferred: ["UPSERT_DAILY_REFLECTION", "UPDATE_JOURNAL", "CREATE_THOUGHT"], discouraged: ["CREATE_TASK"] },
  SOCIAL:       { preferred: ["CREATE_PERSON_UPDATE", "CREATE_TIMELINE_EVENT"], discouraged: [] },
  IDEATION:     { preferred: ["CREATE_IDEA", "CREATE_THOUGHT"], discouraged: [] },
  PRODUCTIVITY: { preferred: ["CREATE_TASK", "CREATE_PROJECT"], discouraged: [] },
  PLANNING:     { preferred: ["CREATE_TASK"], discouraged: [] },
  TRACKING:     { preferred: ["CREATE_ACTIVITY_LOG", "CREATE_THOUGHT"], discouraged: [] },
  DECIDING:     { preferred: ["CREATE_THOUGHT"], discouraged: ["CREATE_TASK"] },
  PREPARING:    { preferred: ["CREATE_EVENT_PLACEHOLDER", "CREATE_REMINDER"], discouraged: [] },
  UNCERTAIN:    { preferred: [], discouraged: [] },
};

export function getNeedGuidance(need: NeedType): NeedActionGuidance {
  return GUIDANCE[need];
}
