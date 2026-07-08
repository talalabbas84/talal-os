import type { Intent } from "@/lib/intelligence/types";
import type { NeedDetectionResult, NeedType } from "./need-types";

const PATTERNS: Array<{ regex: RegExp; need: NeedType }> = [
  { regex: /\b(overwhelmed|stressed out|anxious|scared|worried|i need help|can'?t cope|don'?t know what to do|losing it)\b/i, need: "SUPPORT" },
  { regex: /\b(ugh|so frustrating|so annoying|ridiculous|hate this|this sucks|what the hell|ffs|wtf|drives me crazy)\b/i, need: "VENTING" },
  { regex: /\b(finally|nailed it|crushed it|i won|great news|i did it|managed to|so proud|so happy|amazing news)\b/i, need: "CELEBRATING" },
  { regex: /\b(idea|what if|imagine if|could we|brainstorm|thinking about building|what about making|concept)\b/i, need: "IDEATION" },
  { regex: /\b(met with|meeting with|talked to|dinner with|lunch with|coffee with|caught up with|hangout with)\b/i, need: "SOCIAL" },
  { regex: /\b(plan my|organize my|prioritize|structure my|schedule my|what should i do today|help me plan)\b/i, need: "PLANNING" },
  { regex: /\b(logged|tracking|measured|checked in|status update|progress on|update on)\b/i, need: "TRACKING" },
  { regex: /\b(sick|ill|fever|headache|burnout|exhausted|recovery mode|can'?t sleep|insomnia|tired)\b/i, need: "RECOVERY" },
  { regex: /\b(remember that|note that|save this|don'?t forget|keep in mind|write this down)\b/i, need: "REMEMBERING" },
  { regex: /\b(reflecting on|thinking through|processing|how i feel|what i feel|feeling about)\b/i, need: "REFLECTING" },
  { regex: /\b(i learned|just read|just watched|taught me|interesting fact|new concept|i discovered)\b/i, need: "LEARNING" },
  { regex: /\b(should i|which one|can'?t decide|help me choose|what would you|torn between|not sure if)\b/i, need: "DECIDING" },
  { regex: /\b(before|getting ready for|prep for|preparing for|ahead of|leading up to)\b/i, need: "PREPARING" },
  { regex: /\b(productivity|focus mode|deep work|get things done|power through|ship this|need to finish)\b/i, need: "PRODUCTIVITY" },
];

const INTENT_PRIMARY: Record<Intent, NeedType> = {
  CREATE:     "PRODUCTIVITY",
  UPDATE:     "TRACKING",
  MEMORY:     "REMEMBERING",
  DECISION:   "DECIDING",
  PLAN:       "PLANNING",
  QUESTION:   "LEARNING",
  REFLECTION: "REFLECTING",
  JOURNAL:    "REFLECTING",
  HEALTH:     "HEALTH",
  UNKNOWN:    "UNCERTAIN",
};

export function detectNeeds(text: string, intent: Intent): NeedDetectionResult {
  const primary: NeedType = INTENT_PRIMARY[intent];
  const extra = new Set<NeedType>();

  for (const { regex, need } of PATTERNS) {
    if (need !== primary && regex.test(text)) extra.add(need);
  }

  // Health + recovery always surface SUPPORT as secondary
  if ((primary === "HEALTH" || primary === "RECOVERY" || extra.has("RECOVERY")) && !extra.has("SUPPORT")) {
    extra.add("SUPPORT");
  }

  const secondaryNeeds = [...extra].slice(0, 3);
  const confidence: "high" | "medium" | "low" =
    secondaryNeeds.length >= 2 ? "high" : secondaryNeeds.length === 1 ? "medium" : "low";

  return { primaryNeed: primary, secondaryNeeds, confidence };
}
