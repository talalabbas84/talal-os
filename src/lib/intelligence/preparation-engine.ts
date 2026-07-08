// Preparation Engine — generates FollowUpQueue items proactively.
// Called by a background job (or lazily when user opens dashboard) to:
//   1. Create PREPARATION items for upcoming events
//   2. Create REFLECTION items for recently-passed events
//   3. Create TASK_CHECK items for overdue high-priority tasks
//   4. Create RELATIONSHIP items for people not followed up recently

import { prisma } from "@/lib/prisma";
import { getTemporalContext } from "@/lib/context/temporal-context";
import type { Prisma } from "@prisma/client";

const PREP_LOOKAHEAD_HOURS = 48; // generate prep items for events within 48h
const REFLECTION_WINDOW_HOURS = 24; // reflect on events that ended in last 24h

export async function runPreparationEngine(userId: string): Promise<number> {
  const { now, todayMidnight } = getTemporalContext("America/Toronto");
  let created = 0;

  const [upcoming, recentEvents, overdueTasks, staleRelationships] = await Promise.all([
    getUpcomingEvents(userId, now),
    getRecentPastEvents(userId, now),
    getOverdueTasks(userId, todayMidnight),
    getStaleRelationships(userId, todayMidnight),
  ]);

  // Batch dedup: fetch existing pending items to avoid duplicates
  const existing = await prisma.followUpQueue.findMany({
    where: {
      userId,
      status: "PENDING",
      type: { in: ["PREPARATION", "REFLECTION", "TASK_CHECK", "RELATIONSHIP"] },
    },
    select: { entityType: true, entityId: true, type: true },
  });
  const existingKeys = new Set(
    existing.map((e) => `${e.type}:${e.entityType}:${e.entityId}`),
  );

  const toCreate: Prisma.FollowUpQueueCreateManyInput[] = [];

  for (const ev of upcoming) {
    const key = `PREPARATION:Event:${ev.id}`;
    if (existingKeys.has(key)) continue;
    const hoursUntil = Math.round((ev.date.getTime() - now.getTime()) / 3_600_000);
    toCreate.push({
      userId,
      type: "PREPARATION",
      priority: hoursUntil <= 4 ? 9 : hoursUntil <= 12 ? 7 : 5,
      question: `What do you need to prepare for "${ev.title}"?`,
      reason: `It's happening in about ${hoursUntil}h.`,
      entityType: "Event",
      entityId: ev.id,
      entityLabel: ev.title,
      expiresAt: ev.date,
    });
  }

  for (const ev of recentEvents) {
    const key = `REFLECTION:Event:${ev.id}`;
    if (existingKeys.has(key)) continue;
    toCreate.push({
      userId,
      type: "REFLECTION",
      priority: 6,
      question: `How did "${ev.title}" go?`,
      reason: `It recently passed — capture your thoughts while fresh.`,
      entityType: "Event",
      entityId: ev.id,
      entityLabel: ev.title,
      expiresAt: new Date(now.getTime() + 48 * 3_600_000),
    });
  }

  for (const task of overdueTasks) {
    const key = `TASK_CHECK:Task:${task.id}`;
    if (existingKeys.has(key)) continue;
    toCreate.push({
      userId,
      type: "TASK_CHECK",
      priority: 7,
      question: `"${task.title}" is overdue — still relevant?`,
      reason: `Due ${task.dueDate?.toISOString().split("T")[0] ?? "unknown"} and still open.`,
      entityType: "Task",
      entityId: task.id,
      entityLabel: task.title,
      expiresAt: new Date(now.getTime() + 7 * 24 * 3_600_000),
    });
  }

  for (const person of staleRelationships) {
    const key = `RELATIONSHIP:Person:${person.id}`;
    if (existingKeys.has(key)) continue;
    toCreate.push({
      userId,
      type: "RELATIONSHIP",
      priority: 4,
      question: `Have you been in touch with ${person.name} lately?`,
      reason: "It's been a while since the last interaction.",
      entityType: "Person",
      entityId: person.id,
      entityLabel: person.name,
      expiresAt: new Date(now.getTime() + 14 * 24 * 3_600_000),
    });
  }

  if (toCreate.length > 0) {
    const createResult = await prisma.followUpQueue.createMany({ data: toCreate });
    created = createResult.count;
  }

  return created;
}

async function getUpcomingEvents(userId: string, now: Date) {
  const cutoff = new Date(now.getTime() + PREP_LOOKAHEAD_HOURS * 3_600_000);
  return prisma.eventPlaceholder.findMany({
    where: {
      userId,
      date: { gte: now, lte: cutoff },
    },
    select: { id: true, title: true, date: true },
    orderBy: { date: "asc" },
    take: 5,
  });
}

async function getRecentPastEvents(userId: string, now: Date) {
  const since = new Date(now.getTime() - REFLECTION_WINDOW_HOURS * 3_600_000);
  return prisma.eventPlaceholder.findMany({
    where: {
      userId,
      date: { gte: since, lte: now },
    },
    select: { id: true, title: true, date: true },
    orderBy: { date: "desc" },
    take: 3,
  });
}

async function getOverdueTasks(userId: string, todayMidnight: Date) {
  return prisma.task.findMany({
    where: {
      userId,
      status: "TODO",
      priority: { in: ["HIGH", "URGENT"] },
      dueDate: { lt: todayMidnight },
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 3,
  });
}

async function getStaleRelationships(userId: string, todayMidnight: Date) {
  const cutoff = new Date(todayMidnight.getTime() - 30 * 24 * 3_600_000);
  const cutoffStr = cutoff.toISOString().split("T")[0]!; // "YYYY-MM-DD"
  const recentlyInteracted = await prisma.personInteraction.findMany({
    where: { userId, date: { gte: cutoffStr } },
    select: { personId: true },
  });
  const recentIds = new Set(recentlyInteracted.map((i) => i.personId));

  const allPeople = await prisma.person.findMany({
    where: { userId },
    select: { id: true, name: true },
    take: 20,
  });

  return allPeople.filter((p) => !recentIds.has(p.id)).slice(0, 2);
}
