import { prisma } from "@/lib/prisma";
import { endOfToday, startOfToday } from "./conversation-memory";
import type { CompanionSlot } from "./conversation-types";

export const MAX_CONVERSATIONS_PER_DAY = 3;

export async function getTodaysConversationCount(userId: string): Promise<number> {
  return prisma.conversation.count({
    where: {
      userId,
      createdAt: { gte: startOfToday(), lt: endOfToday() },
    },
  });
}

export function getCurrentConversationSlot(date = new Date()): CompanionSlot {
  const hour = date.getHours();
  if (hour < 12) return "MORNING";
  if (hour < 18) return "AFTERNOON";
  return "EVENING";
}

export async function findPendingConversation(userId: string, slot?: CompanionSlot) {
  return prisma.conversation.findFirst({
    where: {
      userId,
      status: "PENDING",
      ...(slot ? { slot } : {}),
      createdAt: { gte: startOfToday(), lt: endOfToday() },
    },
    include: { answers: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function hasConversationForSlotToday(userId: string, slot: CompanionSlot): Promise<boolean> {
  const count = await prisma.conversation.count({
    where: {
      userId,
      slot,
      createdAt: { gte: startOfToday(), lt: endOfToday() },
    },
  });
  return count > 0;
}

export async function updateMeaningfulStreak(userId: string, meaningful: boolean): Promise<void> {
  if (!meaningful) return;

  const today = startOfToday();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const existing = await prisma.companionStreak.findUnique({
    where: { userId_type: { userId, type: "MEANINGFUL_CONVERSATION" } },
  });
  const last = existing?.lastActivityDate;
  const continued = last && last.getTime() === yesterday.getTime();
  const alreadyToday = last && last.getTime() === today.getTime();
  const nextCount = alreadyToday ? existing.currentCount : continued ? existing.currentCount + 1 : 1;

  await prisma.companionStreak.upsert({
    where: { userId_type: { userId, type: "MEANINGFUL_CONVERSATION" } },
    create: {
      userId,
      type: "MEANINGFUL_CONVERSATION",
      currentCount: 1,
      bestCount: 1,
      lastActivityDate: today,
    },
    update: {
      currentCount: nextCount,
      bestCount: Math.max(existing?.bestCount ?? 0, nextCount),
      lastActivityDate: today,
    },
  });
}
