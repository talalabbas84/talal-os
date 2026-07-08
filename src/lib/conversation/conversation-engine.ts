import { prisma } from "@/lib/prisma";
import type { DiscoveryXpCategory, Prisma } from "@prisma/client";
import { buildConversationContext } from "./conversation-memory";
import {
  buildCompanionFeedback,
  chooseConversationPrompt,
  chooseFollowUpQuestion,
  extractAnswerInsight,
} from "./conversation-prompts";
import {
  findPendingConversation,
  getCurrentConversationSlot,
  getTodaysConversationCount,
  hasConversationForSlotToday,
  MAX_CONVERSATIONS_PER_DAY,
  updateMeaningfulStreak,
} from "./conversation-state";
import type { CompanionSlot, ConversationAnswerResult } from "./conversation-types";

const MODE_TO_XP: Record<string, DiscoveryXpCategory> = {
  REFLECTION: "SELF_AWARENESS",
  SELF_DISCOVERY: "SELF_AWARENESS",
  EMOTIONAL_INTELLIGENCE: "EMOTIONAL_MATURITY",
  LEARNING: "LEARNING",
  DANCE: "DANCE",
  RELATIONSHIPS: "RELATIONSHIPS",
  HEALTH: "HEALTH",
  CAREER: "CAREER",
  INTENTIONAL_LIVING: "LEADERSHIP",
  PLANNING: "LEADERSHIP",
  CHECK_IN: "SELF_AWARENESS",
};

export async function getOrCreateTodaysConversation(userId: string, preferredSlot?: CompanionSlot) {
  const slot = preferredSlot ?? getCurrentConversationSlot();
  const pending = await findPendingConversation(userId, slot) ?? await findPendingConversation(userId);
  if (pending) return pending;

  if (await hasConversationForSlotToday(userId, slot)) return null;

  const count = await getTodaysConversationCount(userId);
  if (count >= MAX_CONVERSATIONS_PER_DAY) return null;

  const context = await buildConversationContext(userId, slot);
  const choice = chooseConversationPrompt(context);

  return prisma.conversation.create({
    data: {
      userId,
      mode: choice.mode,
      slot: choice.slot,
      prompt: choice.prompt,
      contextNote: choice.contextNote,
      source: toJson(choice.source),
      scheduledFor: new Date(),
    },
    include: { answers: true },
  });
}

export async function answerConversation(userId: string, conversationId: string, answer: string): Promise<ConversationAnswerResult> {
  const clean = answer.trim();
  if (clean.length < 2) throw new Error("Answer is too short.");

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { answers: true },
  });
  if (!conversation) throw new Error("Conversation not found.");
  if (conversation.status === "ANSWERED") throw new Error("Conversation already answered.");

  const result = gradeAnswer(conversation.mode, clean, conversation.followUpCount);

  let followUpConversationId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.conversationAnswer.create({
      data: {
        userId,
        conversationId,
        answer: clean,
        feedback: result.feedback,
        insight: result.insight,
        xpCategory: result.xpCategory,
        xpAmount: result.xpAmount,
        meaningful: result.meaningful,
      },
    });

    await tx.discoveryXp.upsert({
      where: { userId_category: { userId, category: result.xpCategory } },
      create: { userId, category: result.xpCategory, xp: result.xpAmount },
      update: { xp: { increment: result.xpAmount } },
    });

    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "ANSWERED",
        answeredAt: new Date(),
        depth: conversation.depth + 1,
      },
    });

    if (result.followUpQuestion && conversation.followUpCount < 2) {
      const todayCount = await tx.conversation.count({
        where: {
          userId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });

      if (todayCount < MAX_CONVERSATIONS_PER_DAY) {
        const followUp = await tx.conversation.create({
          data: {
            userId,
            mode: conversation.mode,
            slot: conversation.slot,
            prompt: result.followUpQuestion,
            contextNote: `Follow-up from: ${conversation.prompt}`,
            followUpCount: conversation.followUpCount + 1,
            depth: conversation.depth + 1,
            source: toJson({ parentConversationId: conversation.id, parentAnswer: clean }),
            scheduledFor: new Date(),
          },
        });
        followUpConversationId = followUp.id;
      }
    }

    if (result.meaningful) {
      const insightCategory = xpToInsightCategory(result.xpCategory);
      await tx.personalInsight.create({
        data: {
          userId,
          category: insightCategory,
          title: `Conversation insight: ${conversation.mode.toLowerCase().replace(/_/g, " ")}`,
          description: result.insight,
          confidence: result.xpAmount >= 10 ? "HIGH" : "MEDIUM",
          importance: result.xpAmount >= 10 ? "HIGH" : "MEDIUM",
          evidence: [{ question: conversation.prompt, answer: clean, capturedAt: new Date().toISOString() }],
        },
      });

      await tx.timelineEvent.create({
        data: {
          userId,
          title: `Meaningful ${conversation.mode.toLowerCase().replace(/_/g, " ")} conversation`,
          description: result.insight,
          category: insightCategory,
          occurredAt: new Date(),
          importance: result.xpAmount >= 10 ? "HIGH" : "MEDIUM",
          evidence: [{ question: conversation.prompt, answer: clean, xp: result.xpAmount }],
        },
      });

      await tx.dailyReflection.upsert({
        where: { userId_date: { userId, date: startOfTodayDate() } },
        create: {
          userId,
          date: startOfTodayDate(),
          whatHappened: `Conversation: ${conversation.prompt}`,
          learned: result.insight,
          tomorrowRecommendation: "Use this conversation as context for tomorrow's planning.",
        },
        update: {
          learned: result.insight,
          tomorrowRecommendation: "Use this conversation as context for tomorrow's planning.",
        },
      });
    }
  });

  await updateMeaningfulStreak(userId, result.meaningful);
  return { ...result, followUpConversationId };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function startOfTodayDate(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function gradeAnswer(mode: string, answer: string, followUpCount: number): ConversationAnswerResult {
  const words = answer.split(/\s+/).filter(Boolean).length;
  const meaningful = words >= 12 || /\b(realized|noticed|felt|because|learned|afraid|proud|avoid|want)\b/i.test(answer);
  const xpAmount = meaningful ? (words >= 35 ? 12 : 8) : 3;
  const xpCategory = MODE_TO_XP[mode] ?? "SELF_AWARENESS";
  const feedback = buildCompanionFeedback(answer);
  const insight = extractAnswerInsight(answer);
  const followUpQuestion = followUpCount < 2 ? chooseFollowUpQuestion(answer, followUpCount) : null;

  return { feedback, insight, xpCategory, xpAmount, meaningful, followUpQuestion };
}

function xpToInsightCategory(category: DiscoveryXpCategory) {
  switch (category) {
    case "EMOTIONAL_MATURITY":
      return "EMOTIONAL";
    case "HEALTH":
      return "HEALTH";
    case "RELATIONSHIPS":
      return "RELATIONSHIP";
    case "LEARNING":
      return "LEARNING";
    case "CAREER":
    case "LEADERSHIP":
      return "GROWTH";
    case "DANCE":
      return "GROWTH";
    case "COMMUNICATION":
      return "COMMUNICATION";
    case "SELF_AWARENESS":
    default:
      return "IDENTITY";
  }
}
