import type { PersonalInsightCategory, PlannedAction } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

export function generatePersonalInsights(input: PersonalIntelligenceInput): PlannedAction[] {
  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const actions: PlannedAction[] = [];

  if (/\b(tired|exhausted|sick|burnt out|burned out|low energy)\b/.test(lower)) {
    actions.push(personalInsight("HEALTH", "Energy state affects execution", "Talal's current physical state is relevant to planning and recommendations.", text, "MEDIUM"));
  }

  if (/\b(overthinking|overwhelmed|too many options|can't decide|cannot decide|stuck deciding)\b/.test(lower)) {
    actions.push(personalInsight("DECISION", "Decision friction appears when options expand", "Talal may need simpler defaults, fewer choices, and one next step when decision load is high.", text, "HIGH"));
  }

  if (/\b(learned|studied|read|book|vocabulary|word|course|class)\b/.test(lower)) {
    actions.push(personalInsight("LEARNING", "Capture is a learning channel", "Talal uses raw capture to preserve what he is learning, so review and retention should happen automatically.", text, "MEDIUM"));
  }

  if (/\b(dance|bachata|salsa|performance)\b/.test(lower)) {
    actions.push(personalInsight("GROWTH", "Dance is part of identity and growth", "Dance-related captures should influence confidence, social growth, and energy recommendations.", text, "MEDIUM"));
  }

  if (/\b(sarah|sara|friend|met|talked|conversation|follow up|birthday)\b/.test(lower)) {
    actions.push(personalInsight("RELATIONSHIP", "Relationships need context continuity", "People details and follow-ups should be retained so Talal does not carry relationship context manually.", text, "MEDIUM"));
  }

  if (/\b(money|finance|budget|invest|debt|spend|saving|savings)\b/.test(lower)) {
    actions.push(personalInsight("FINANCE", "Financial captures should become future planning context", "Money-related thoughts should shape recommendations with rational, low-drama planning.", text, "MEDIUM"));
  }

  if (/\b(i want to become|i'm becoming|im becoming|future me|identity|the kind of person)\b/.test(lower)) {
    actions.push(personalInsight("IDENTITY", "Talal is explicitly defining identity", "Identity statements should update the personal profile and future recommendations.", text, "HIGH"));
  }

  return dedupeByTitle(actions);
}

function personalInsight(
  category: PersonalInsightCategory,
  title: string,
  description: string,
  evidence: string,
  confidence: "LOW" | "MEDIUM" | "HIGH",
): PlannedAction {
  return {
    id: makePersonalActionId("personal-insight", `${category}:${title}:${evidence}`),
    type: "CREATE_PERSONAL_INSIGHT",
    label: `Personal insight: ${title}`,
    payload: {
      category,
      title,
      description,
      confidence,
      evidence: [{ text: evidence, capturedAt: new Date().toISOString() }],
      importance: confidence === "HIGH" ? "HIGH" : "MEDIUM",
    },
  };
}

function dedupeByTitle(actions: PlannedAction[]): PlannedAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
