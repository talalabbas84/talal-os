import type { PlannedAction, GrowthDimension } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

export function planPersonalGrowth(input: PersonalIntelligenceInput): PlannedAction[] {
  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const dimensions = new Set<GrowthDimension>();

  if (/\b(dance|bachata|salsa|performance)\b/.test(lower)) dimensions.add("DANCE");
  if (/\b(gym|workout|fitness|sick|tired|sleep|health)\b/.test(lower)) dimensions.add("HEALTH");
  if (/\b(learned|read|book|course|vocabulary|word|study)\b/.test(lower)) dimensions.add("LEARNING");
  if (/\b(friend|met|talked|relationship|sarah|sara)\b/.test(lower)) dimensions.add("RELATIONSHIPS");
  if (/\b(speak|presentation|conversation|communicate|message)\b/.test(lower)) dimensions.add("COMMUNICATION");
  if (/\b(confident|confidence|afraid|anxious|shy)\b/.test(lower)) dimensions.add("CONFIDENCE");
  if (/\b(career|job|work|business|crm|talal os|project)\b/.test(lower)) dimensions.add("CAREER");
  if (/\b(money|finance|budget|invest|saving|debt)\b/.test(lower)) dimensions.add("FINANCIAL_LITERACY");
  if (/\b(decide|decision|choice|options|overwhelmed)\b/.test(lower)) dimensions.add("DECISION_MAKING");
  if (/\b(lead|team|manager|ownership)\b/.test(lower)) dimensions.add("LEADERSHIP");
  if (/\b(emotional|angry|sad|stressed|reacted|mature)\b/.test(lower)) dimensions.add("EMOTIONAL_MATURITY");

  return Array.from(dimensions).slice(0, 3).map((dimension) => growthAction(dimension, text, lower));
}

function growthAction(dimension: GrowthDimension, text: string, lower: string): PlannedAction {
  const positive = /\b(done|completed|better|good|win|learned|improved|proud|confident)\b/.test(lower);
  const challenge = /\b(tired|sick|stuck|hard|struggled|anxious|avoid|skipped|overwhelmed)\b/.test(lower);

  return {
    id: makePersonalActionId("personal-growth", `${dimension}:${text}`),
    type: "UPSERT_PERSONAL_GROWTH_AREA",
    label: `Growth momentum: ${formatDimension(dimension)}`,
    payload: {
      dimension,
      currentConfidence: positive ? "Evidence of progress captured today." : challenge ? "Confidence may need support right now." : "New signal captured.",
      momentum: positive ? "GROWING" : challenge ? "NEEDS_ATTENTION" : "STABLE",
      recentWins: positive ? [{ text, capturedAt: new Date().toISOString() }] : undefined,
      currentChallenge: challenge ? text : null,
      nextRecommendation: challenge
        ? "Reduce the next step until it feels executable."
        : "Keep capturing small evidence; review it before planning tomorrow.",
    },
  };
}

function formatDimension(dimension: string): string {
  return dimension.toLowerCase().replace(/_/g, " ");
}
