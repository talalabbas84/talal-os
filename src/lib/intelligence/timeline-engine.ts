// Life Timeline Engine — universal chronological ledger.
// Records every meaningful life event so temporal queries become possible:
// "What changed between March and June?" / "When did X become important?"
//
// Distinct from TimelineEvent (personal insight events created by the AI).
// This module does mechanical recording — no inference, no AI calls.

import { prisma } from "@/lib/prisma";
import type { LifeEntityType, LifeCategory, MemoryImportance } from "@prisma/client";

export type { LifeEntityType, LifeCategory };

export interface LifeEventInput {
  title: string;
  summary?: string;
  occurredAt: Date;
  entityType: LifeEntityType;
  entityId?: string;
  category?: LifeCategory;
  importance?: MemoryImportance;
}

// Batch-insert all timeline entries for a capture session.
// Called once at the end of executeActions — zero latency on the hot path.
export async function batchRecordLifeEvents(userId: string, entries: LifeEventInput[]): Promise<void> {
  if (!entries.length) return;
  await prisma.lifeTimelineEntry.createMany({
    data: entries.map((e) => ({
      userId,
      title: e.title,
      summary: e.summary ?? null,
      occurredAt: e.occurredAt,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      category: e.category ?? "PERSONAL",
      importance: e.importance ?? "MEDIUM",
    })),
  });
}

// Query the life timeline by date range.
// Returns entries sorted by occurredAt descending (most recent first).
export async function getLifeTimeline(
  userId: string,
  opts: {
    from?: Date;
    to?: Date;
    entityType?: LifeEntityType;
    category?: LifeCategory;
    limit?: number;
  } = {},
) {
  const { from, to, entityType, category, limit = 50 } = opts;

  return prisma.lifeTimelineEntry.findMany({
    where: {
      userId,
      ...(from || to
        ? {
            occurredAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(entityType ? { entityType } : {}),
      ...(category ? { category } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
