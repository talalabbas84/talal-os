import type { NeedType } from "./need-types";

const RESPONSES: Partial<Record<NeedType, string>> = {
  SUPPORT:      "I hear you. Let's take this one step at a time.",
  RECOVERY:     "Rest comes first. Let's keep it light.",
  HEALTH:       "I'm sorry you're not feeling well. Take care of the essentials only.",
  VENTING:      "Logged and heard. Sometimes that's all you need.",
  CELEBRATING:  "That's worth noting. Well done.",
  REMEMBERING:  "Saved. I'll hold onto that for you.",
  DECIDING:     "Let's cut through the noise and find the one thing that matters.",
  PLANNING:     "Let's get you organized.",
  REFLECTING:   "Good time to sit with that. I'll help you capture it clearly.",
  IDEATION:     "Ideas captured. The best ones tend to come back.",
  SOCIAL:       "Logged. Relationships are worth tracking.",
  LEARNING:     "Filed for review. Repetition builds it in.",
  TRACKING:     "Logged.",
  PRODUCTIVITY: "Let's get this organized and off your mind.",
  PREPARING:    "Saved. I'll make sure you're ready.",
};

export function generateNeedResponse(
  primaryNeed: NeedType,
  secondaryNeeds: NeedType[],
): string | null {
  const primary = RESPONSES[primaryNeed];
  if (primary) return primary;
  for (const secondary of secondaryNeeds) {
    const res = RESPONSES[secondary];
    if (res) return res;
  }
  return null;
}
