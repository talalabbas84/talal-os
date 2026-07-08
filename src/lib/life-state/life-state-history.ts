import { prisma } from "@/lib/prisma";
import type { LifeStateRecord } from "@prisma/client";
import type { LifeStateType } from "./life-state-types";

export async function recordStateTransition(
  userId: string,
  to: LifeStateType,
  triggeredBy: string,
  now: Date,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.lifeStateRecord.updateMany({
      where: { userId, exitedAt: null },
      data: { exitedAt: now },
    });
    await tx.lifeStateRecord.create({
      data: { userId, state: to, enteredAt: now, triggeredBy },
    });
  });
}

export async function getStateHistory(userId: string, limit = 20): Promise<LifeStateRecord[]> {
  return prisma.lifeStateRecord.findMany({
    where: { userId },
    orderBy: { enteredAt: "desc" },
    take: limit,
  });
}

export async function getCurrentStateRecord(userId: string): Promise<LifeStateRecord | null> {
  return prisma.lifeStateRecord.findFirst({
    where: { userId, exitedAt: null },
    orderBy: { enteredAt: "desc" },
  });
}
