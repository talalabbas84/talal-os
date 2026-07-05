import type { PersonalProfilePayload, PlannedAction } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

export function updateIdentityProfile(input: PersonalIntelligenceInput): PlannedAction[] {
  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const payload: PersonalProfilePayload = {};

  if (/\b(i want to become|i want to be|future me|the kind of person|my identity)\b/.test(lower)) {
    payload.futureIdentity = text;
  }

  if (/\b(i am|i'm|im)\b/.test(lower) && /\b(builder|dancer|learner|founder|engineer|disciplined|healthy)\b/.test(lower)) {
    payload.currentIdentity = text;
  }

  if (/\b(my mission|mission is|purpose is|goal is)\b/.test(lower)) {
    payload.mission = text;
  }

  if (/\b(value|values|important to me|i care about)\b/.test(lower)) {
    payload.coreValues = [{ text, capturedAt: new Date().toISOString() }];
  }

  if (Object.keys(payload).length === 0) return [];

  return [{
    id: makePersonalActionId("personal-profile", text),
    type: "UPSERT_PERSONAL_PROFILE",
    label: "Update personal profile",
    payload,
  }];
}
