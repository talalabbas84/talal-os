import type { PlannedAction } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

export function planTimelineEvents(input: PersonalIntelligenceInput): PlannedAction[] {
  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const important = /\b(started|launched|moved|joined|quit|stopped|bought|graduated|accepted|recovered|first time|milestone)\b/.test(lower);
  if (!important) return [];

  const category = /\b(health|sick|recovered|gym|fitness)\b/.test(lower)
    ? "HEALTH"
    : /\b(dance|bachata|salsa|performance)\b/.test(lower)
      ? "GROWTH"
      : /\b(job|career|work|business|talal os|project)\b/.test(lower)
        ? "PRODUCTIVITY"
        : /\b(friend|relationship|met|sarah|sara)\b/.test(lower)
          ? "RELATIONSHIP"
          : "LIFE_PATTERN";

  return [{
    id: makePersonalActionId("timeline-event", text),
    type: "CREATE_TIMELINE_EVENT",
    label: "Add life timeline event",
    payload: {
      title: summarizeTitle(text),
      description: text,
      category,
      occurredAt: new Date().toISOString(),
      importance: "HIGH",
      evidence: [{ text, capturedAt: new Date().toISOString() }],
    },
  }];
}

export function planDailyReflectionFromCapture(input: PersonalIntelligenceInput): PlannedAction[] {
  const lower = input.cleanedText.toLowerCase();
  const reflective = /\b(today|tonight|this morning|this evening|went well|learned|struggled|difficult|improve tomorrow)\b/.test(lower);
  if (!reflective) return [];

  return [{
    id: makePersonalActionId("daily-reflection", input.cleanedText),
    type: "UPSERT_DAILY_REFLECTION",
    label: "Update daily reflection",
    payload: {
      date: new Date().toISOString(),
      whatHappened: input.cleanedText,
      learned: /\b(learned|realized|noticed)\b/.test(lower) ? input.cleanedText : undefined,
      improved: /\b(improved|better|win|went well|completed|done)\b/.test(lower) ? input.cleanedText : undefined,
      struggled: /\b(struggled|hard|difficult|tired|sick|stressed|anxious)\b/.test(lower) ? input.cleanedText : undefined,
      tomorrowRecommendation: "Use this reflection as context when generating tomorrow's plan.",
    },
  }];
}

function summarizeTitle(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}
