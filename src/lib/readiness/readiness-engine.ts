// Readiness Engine — orchestrates ReadinessPlan generation and retrieval.
//
// Flow:
//   1. Find upcoming EventPlaceholders (next 7 days) without existing plans
//   2. For each, call buildReadinessPlan() and upsert to DB
//   3. Expire plans for past events
//   4. Return plans for dashboard (scheduledFor within next 24h)

import { prisma } from "@/lib/prisma";
import { getTemporalContext } from "@/lib/context/temporal-context";
import type { Prisma } from "@prisma/client";
import { buildReadinessPlan, buildScheduledFor } from "./readiness-builder";
import type { ReadinessPlanData, PreparedItem, MissingItem, ReadinessRecommendation } from "./readiness-types";

const LOOKAHEAD_DAYS = 7;
const DASHBOARD_HOURS = 24; // show plans for events within next 24h

export async function runReadinessEngine(userId: string): Promise<number> {
  const { now, todayMidnight } = getTemporalContext("America/Toronto");
  const cutoff = new Date(todayMidnight.getTime() + LOOKAHEAD_DAYS * 24 * 3_600_000);

  // Mark past plans as COMPLETED
  await prisma.readinessPlan.updateMany({
    where: {
      userId,
      status: { notIn: ["COMPLETED"] },
      scheduledFor: { lt: now },
    },
    data: { status: "COMPLETED" },
  });

  // Find upcoming events
  const events = await prisma.eventPlaceholder.findMany({
    where: {
      userId,
      date: { gte: todayMidnight, lte: cutoff },
    },
    include: { relatedPerson: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  if (events.length === 0) return 0;

  // Find existing plans to avoid duplicates
  const existingEntityIds = new Set(
    (
      await prisma.readinessPlan.findMany({
        where: { userId, entityType: "EVENT", entityId: { in: events.map((e) => e.id) } },
        select: { entityId: true },
      })
    ).map((p) => p.entityId),
  );

  const toGenerate = events.filter((e) => !existingEntityIds.has(e.id));
  let created = 0;

  for (const event of toGenerate) {
    try {
      const scheduledFor = buildScheduledFor(event.date, event.time);
      const plan = await buildReadinessPlan({
        userId,
        entityType: "EVENT",
        entityId: event.id,
        title: event.title,
        scheduledFor,
        location: event.location ?? undefined,
        description: event.description ?? undefined,
        linkedPersonId: event.relatedPerson?.id,
        linkedPersonName: event.relatedPerson?.name,
      });

      await prisma.readinessPlan.upsert({
        where: { userId_entityType_entityId: { userId, entityType: "EVENT", entityId: event.id } },
        create: {
          userId,
          entityType: plan.entityType,
          entityId: plan.entityId,
          title: plan.title,
          scheduledFor: plan.scheduledFor,
          status: plan.status,
          overallReadiness: plan.overallReadiness,
          preparedItems: plan.preparedItems as unknown as Prisma.InputJsonValue,
          missingItems: plan.missingItems as unknown as Prisma.InputJsonValue,
          recommendations: plan.recommendations as unknown as Prisma.InputJsonValue,
          focusTip: plan.focusTip,
        },
        update: {
          overallReadiness: plan.overallReadiness,
          preparedItems: plan.preparedItems as unknown as Prisma.InputJsonValue,
          missingItems: plan.missingItems as unknown as Prisma.InputJsonValue,
          recommendations: plan.recommendations as unknown as Prisma.InputJsonValue,
          focusTip: plan.focusTip,
          updatedAt: new Date(),
        },
      });
      created++;
    } catch {
      // Don't let one bad event break the loop
    }
  }

  return created;
}

// For dashboard: lazily run engine then return plans within next DASHBOARD_HOURS
export async function getReadinessForDashboard(userId: string, limit = 3): Promise<ReadinessPlanData[]> {
  await runReadinessEngine(userId).catch(() => undefined);

  const { now } = getTemporalContext("America/Toronto");
  const windowEnd = new Date(now.getTime() + DASHBOARD_HOURS * 3_600_000);

  const plans = await prisma.readinessPlan.findMany({
    where: {
      userId,
      status: { notIn: ["COMPLETED"] },
      scheduledFor: { gte: now, lte: windowEnd },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  return plans.map((p) => ({
    id: p.id,
    entityType: p.entityType,
    entityId: p.entityId,
    title: p.title,
    scheduledFor: p.scheduledFor,
    status: p.status,
    overallReadiness: p.overallReadiness,
    preparedItems: (p.preparedItems as unknown as PreparedItem[]) ?? [],
    missingItems: (p.missingItems as unknown as MissingItem[]) ?? [],
    recommendations: (p.recommendations as unknown as ReadinessRecommendation[]) ?? [],
    focusTip: p.focusTip,
    generatedAt: p.generatedAt,
  }));
}
