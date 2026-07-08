import { prisma } from "@/lib/prisma";
import type { ConversationContext, CompanionSlot } from "./conversation-types";

export async function buildConversationContext(userId: string, slot: CompanionSlot): Promise<ConversationContext> {
  const today = startOfToday();
  const [recentCaptures, recentThoughts, recentActivities, recentPeople, dueLearning, habits, currentGrowth, recentInsights, previousAnswers, xp] = await Promise.all([
    prisma.inboxEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { title: true, description: true, createdAt: true },
    }),
    prisma.thought.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { summary: true, cleanedText: true, category: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      where: { userId, createdAt: { gte: today } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { activity: true, category: true, createdAt: true, mood: true },
    }),
    prisma.personInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { personNameSnapshot: true, summary: true, sentiment: true, createdAt: true },
    }),
    prisma.learningItem.findMany({
      where: { userId, nextReviewAt: { lte: new Date() } },
      orderBy: { nextReviewAt: "asc" },
      take: 4,
      select: { title: true, category: true, nextReviewAt: true },
    }),
    prisma.habit.findMany({
      where: { userId, isActive: true },
      include: { completions: { where: { date: today } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.personalGrowthArea.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { dimension: true, momentum: true, currentChallenge: true, nextRecommendation: true },
    }),
    prisma.personalInsight.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { title: true, description: true, category: true, createdAt: true },
    }),
    prisma.conversationAnswer.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { conversation: { select: { mode: true } } },
    }),
    prisma.discoveryXp.findMany({
      where: { userId },
      orderBy: { xp: "desc" },
      take: 9,
      select: { category: true, xp: true },
    }),
  ]);

  return {
    slot,
    recentCaptures,
    recentThoughts,
    recentActivities,
    recentPeople,
    dueLearning,
    habitsDue: habits.filter((habit) => habit.completions.length === 0).map((habit) => ({ name: habit.name })),
    currentGrowth,
    recentInsights,
    previousAnswers: previousAnswers.map((answer) => ({
      answer: answer.answer,
      insight: answer.insight,
      createdAt: answer.createdAt,
      mode: answer.conversation.mode,
    })),
    xp,
  };
}

export function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfToday(): Date {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}
