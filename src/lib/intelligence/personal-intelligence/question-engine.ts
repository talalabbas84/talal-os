import { prisma } from "@/lib/prisma";
import type { PlannedAction } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { makePersonalActionId } from "./types";

export async function generateCuriosityQuestion(input: PersonalIntelligenceInput): Promise<PlannedAction[]> {
  const openToday = await prisma.reflectionQuestion.count({
    where: {
      userId: input.userId,
      status: "OPEN",
      createdAt: { gte: startOfToday() },
    },
  });
  if (openToday >= 3) return [];

  const text = input.cleanedText;
  const lower = text.toLowerCase();
  const question = selectQuestion(lower);
  if (!question) return [];

  return [{
    id: makePersonalActionId("reflection-question", `${question.question}:${text}`),
    type: "CREATE_REFLECTION_QUESTION",
    label: `Reflection question: ${question.question}`,
    payload: {
      question: question.question,
      reason: question.reason,
      priority: question.priority,
      relatedCapture: text,
      relatedInsight: null,
    },
  }];
}

function selectQuestion(lower: string): { question: string; reason: string; priority: "LOW" | "MEDIUM" | "HIGH" } | null {
  if (/\b(skip|skipped|not today|later|tomorrow|reschedule)\b/.test(lower) && /\b(dance|gym|workout|habit|task)\b/.test(lower)) {
    return {
      question: "What made this feel like something to postpone?",
      reason: "Understanding the cause helps Talal OS distinguish avoidance, recovery, and genuine replanning.",
      priority: "MEDIUM",
    };
  }

  if (/\b(tired|exhausted|sick|burnt out|burned out|low energy)\b/.test(lower)) {
    return {
      question: "What do you think caused the low energy today?",
      reason: "Energy context changes tomorrow's recommendation.",
      priority: "MEDIUM",
    };
  }

  if (/\b(anxious|worried|stressed|afraid|fear)\b/.test(lower)) {
    return {
      question: "What were you worried would happen?",
      reason: "This clarifies whether the issue is risk, uncertainty, or self-pressure.",
      priority: "HIGH",
    };
  }

  if (/\b(learned|vocabulary|word|book|read|course)\b/.test(lower)) {
    return {
      question: "Where can you use this learning in real life this week?",
      reason: "Retention improves when learning is tied to use.",
      priority: "LOW",
    };
  }

  if (/\b(met|talked|conversation|sarah|sara|friend)\b/.test(lower)) {
    return {
      question: "How did that interaction feel to you?",
      reason: "Relationship context is more useful when it includes emotional signal, not only facts.",
      priority: "MEDIUM",
    };
  }

  return null;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
