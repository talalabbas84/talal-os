import { prisma } from "@/lib/prisma";
import type { PlannedAction, PersonalInsightCategory } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

interface CandidatePattern {
  category: PersonalInsightCategory;
  title: string;
  description: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  priorInsightTitle: string;
}

export async function detectPersonalPatterns(input: PersonalIntelligenceInput): Promise<PlannedAction[]> {
  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const candidates: CandidatePattern[] = [];

  if (/\b(overthinking|overwhelmed|too many options|can't decide|cannot decide|stuck deciding)\b/.test(lower)) {
    candidates.push({
      category: "DECISION",
      title: "Decision friction increases with too many options",
      description: "Talal tends to need a narrowed set of options and one next step when decision load increases.",
      confidence: "MEDIUM",
      priorInsightTitle: "Decision friction",
    });
  }

  if (/\b(tired|exhausted|sick|burnt out|burned out|low energy)\b/.test(lower)) {
    candidates.push({
      category: "HEALTH",
      title: "Low energy changes the right plan",
      description: "Talal's plan should adapt when health or energy is low instead of forcing normal execution.",
      confidence: "MEDIUM",
      priorInsightTitle: "Energy state",
    });
  }

  if (/\b(skip|not today|later|tomorrow|reschedule)\b/.test(lower) && /\b(gym|dance|task|workout|habit)\b/.test(lower)) {
    candidates.push({
      category: "PRODUCTIVITY",
      title: "Execution slips are usually rescheduling signals",
      description: "When Talal delays a commitment, the system should convert it into an explicit next step instead of losing it.",
      confidence: "MEDIUM",
      priorInsightTitle: "Execution slips",
    });
  }

  if (/\b(dance|bachata|salsa)\b/.test(lower) && /\b(better|happy|confident|energy|good)\b/.test(lower)) {
    candidates.push({
      category: "GROWTH",
      title: "Dance supports confidence and energy",
      description: "Dance appears connected to Talal's confidence, social growth, or energy.",
      confidence: "MEDIUM",
      priorInsightTitle: "Dance",
    });
  }

  const actions: PlannedAction[] = [];
  for (const candidate of candidates) {
    const existing = await prisma.personalPattern.findUnique({
      where: { userId_title: { userId: input.userId, title: candidate.title } },
    });
    const priorEvidence = await prisma.personalInsight.count({
      where: {
        userId: input.userId,
        category: candidate.category,
        title: { contains: candidate.priorInsightTitle, mode: "insensitive" },
      },
    });

    const explicitRecurrence = /\b(always|again|keeps happening|every time|usually|often|pattern)\b/.test(lower);
    const hasRepeatedEvidence = existing || explicitRecurrence || priorEvidence > 0;
    if (hasRepeatedEvidence) {
      actions.push({
        id: makePersonalActionId("personal-pattern", `${candidate.title}:${text}`),
        type: "UPSERT_PERSONAL_PATTERN",
        label: `Pattern: ${candidate.title}`,
        payload: {
          category: candidate.category,
          title: candidate.title,
          description: candidate.description,
          confidence: candidate.confidence,
          evidence: [{ text, capturedAt: new Date().toISOString() }],
          lastSeen: new Date().toISOString(),
          occurrences: explicitRecurrence ? 2 : undefined,
        },
      });
    }
  }

  return actions;
}
