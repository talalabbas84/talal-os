"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runPreparationEngine } from "@/lib/intelligence/preparation-engine";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getFollowUpQueueItems(limit = 3) {
  const userId = await requireUserId();

  // Lazily run preparation engine — cheap because it deduplicates internally
  await runPreparationEngine(userId).catch(() => undefined);

  // Expire old items
  await prisma.followUpQueue.updateMany({
    where: {
      userId,
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });

  return prisma.followUpQueue.findMany({
    where: { userId, status: "PENDING" },
    orderBy: [{ priority: "desc" }, { suggestedAt: "asc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      priority: true,
      question: true,
      reason: true,
      entityType: true,
      entityLabel: true,
      suggestedAt: true,
    },
  });
}

export async function answerFollowUpItem(id: string, answer: string) {
  const userId = await requireUserId();
  await prisma.followUpQueue.updateMany({
    where: { id, userId },
    data: {
      status: "ANSWERED",
      answer,
      answeredAt: new Date(),
    },
  });
  revalidatePath("/");
}

export async function dismissFollowUpItem(id: string) {
  const userId = await requireUserId();
  await prisma.followUpQueue.updateMany({
    where: { id, userId },
    data: { status: "DISMISSED" },
  });
  revalidatePath("/");
}
