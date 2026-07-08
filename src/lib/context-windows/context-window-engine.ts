// Context Windows Engine — orchestrates Previous/Current/Next window detection,
// generates the transition bridge, and persists to ContextWindow in the DB.

import { prisma } from "@/lib/prisma";
import { getTemporalContext } from "@/lib/context/temporal-context";
import { buildPreviousWindow, buildCurrentWindow, buildNextWindow } from "./context-window-builder";
import { generateTransitionBridge } from "./transition-bridge";
import type { ContextWindowData, PersonContext, WindowFrame } from "./context-window-types";
import type { LifeStateType } from "@/lib/life-state/life-state-types";

export type { ContextWindowData } from "./context-window-types";

// ── Main runner ───────────────────────────────────────────────────────────────
// Fetches all needed data, builds the three windows, generates bridge, persists.

export async function runContextWindowEngine(userId: string): Promise<ContextWindowData> {
  const temporal = getTemporalContext("America/Toronto");
  const now = temporal.now;
  const today = temporal.todayMidnight;
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const tomorrowEnd = new Date(tomorrow.getTime() + 86_400_000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 3_600_000);
  const twentyFourHoursAhead = new Date(now.getTime() + 24 * 3_600_000);

  const [userState, recentActivities, todayEvents, tomorrowEvents, readinessPlans, topTask] =
    await Promise.all([
      prisma.userState.findUnique({ where: { userId } }),
      prisma.activityLog.findMany({
        where: { userId, createdAt: { gte: fourHoursAgo } },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.eventPlaceholder.findMany({
        where: { userId, date: { gte: today, lt: tomorrow } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.eventPlaceholder.findMany({
        where: { userId, date: { gte: tomorrow, lt: tomorrowEnd } },
        orderBy: { createdAt: "asc" },
        take: 2,
      }),
      prisma.readinessPlan.findMany({
        where: {
          userId,
          scheduledFor: { gte: now, lte: twentyFourHoursAhead },
          status: { notIn: ["COMPLETED"] },
        },
        orderBy: { scheduledFor: "asc" },
        take: 3,
      }),
      prisma.task.findFirst({
        where: { userId, status: { not: "DONE" }, priority: { in: ["HIGH", "URGENT"] } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
    ]);

  const lifeState = (userState?.currentLifeState ?? "DEFAULT") as LifeStateType;
  const currentActivityName = recentActivities[0]?.activity ?? null;

  // ── Build windows ─────────────────────────────────────────────────────────
  const previous = buildPreviousWindow(recentActivities, todayEvents, now);
  const current = buildCurrentWindow(lifeState, currentActivityName);
  const { frame: next, linkedPersonId, scheduledAt } = buildNextWindow(
    todayEvents,
    tomorrowEvents,
    readinessPlans,
    topTask,
    now,
  );

  // ── Person context for bridge ────────────────────────────────────────────
  let personContext: PersonContext | null = null;
  if (linkedPersonId) {
    const [person, lastInteraction] = await Promise.all([
      prisma.person.findUnique({ where: { id: linkedPersonId } }),
      prisma.personInteraction.findFirst({
        where: { userId, personId: linkedPersonId },
        orderBy: { date: "desc" },
      }),
    ]);
    if (person) {
      personContext = {
        name: person.name,
        lastTopic: lastInteraction?.topics[0] ?? undefined,
        lastSummary: lastInteraction?.summary ?? undefined,
      };
    }
  }

  // ── Bridge recommendation ────────────────────────────────────────────────
  const minutesUntilNext = scheduledAt
    ? (scheduledAt.getTime() - now.getTime()) / 60_000
    : null;
  const bridge = generateTransitionBridge(previous, current, next, minutesUntilNext, personContext);

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const upsertData = {
    previousSummary:      previous?.summary ?? null,
    currentSummary:       current.summary,
    nextSummary:          next?.summary ?? null,
    previousEntityType:   previous?.entityType ?? null,
    previousEntityId:     previous?.entityId ?? null,
    currentEntityType:    current.entityType ?? null,
    currentEntityId:      current.entityId ?? null,
    nextEntityType:       next?.entityType ?? null,
    nextEntityId:         next?.entityId ?? null,
    bridgeRecommendation: bridge,
  };

  const record = await prisma.contextWindow.upsert({
    where:  { userId },
    update: upsertData,
    create: { userId, ...upsertData },
  });

  return {
    id: record.id,
    userId: record.userId,
    previous: record.previousSummary
      ? toFrame(record.previousSummary, record.previousEntityType, record.previousEntityId, previous?.category)
      : null,
    current: { summary: record.currentSummary ?? current.summary, category: current.category },
    next: record.nextSummary
      ? toFrame(record.nextSummary, record.nextEntityType, record.nextEntityId, next?.category)
      : null,
    bridgeRecommendation: record.bridgeRecommendation,
    updatedAt: record.updatedAt,
  };
}

// ── Public read (cached) ──────────────────────────────────────────────────────
// Returns the most recently stored ContextWindow without recomputing.

export async function getContextWindow(userId: string): Promise<ContextWindowData | null> {
  const record = await prisma.contextWindow.findUnique({ where: { userId } });
  if (!record) return null;
  return {
    id: record.id,
    userId: record.userId,
    previous: record.previousSummary
      ? toFrame(record.previousSummary, record.previousEntityType, record.previousEntityId, undefined)
      : null,
    current: record.currentSummary
      ? { summary: record.currentSummary, category: "current" }
      : null,
    next: record.nextSummary
      ? toFrame(record.nextSummary, record.nextEntityType, record.nextEntityId, undefined)
      : null,
    bridgeRecommendation: record.bridgeRecommendation,
    updatedAt: record.updatedAt,
  };
}

// ── Capture integration ───────────────────────────────────────────────────────
// Call this after a capture is saved to refresh the context windows.

export async function refreshContextWindow(userId: string): Promise<void> {
  await runContextWindowEngine(userId);
}

// ── Notification foundation ───────────────────────────────────────────────────
// Returns a human-readable contextual notification string, or null.
// Intended for future push notification integration.

export async function getContextualNotification(userId: string): Promise<string | null> {
  const cw = await getContextWindow(userId);
  if (!cw?.bridgeRecommendation) return null;
  const parts: string[] = [];
  if (cw.current?.summary) parts.push(`${cw.current.summary}.`);
  if (cw.next?.summary) parts.push(`Up next: ${cw.next.summary}.`);
  parts.push(cw.bridgeRecommendation);
  return parts.join(" ");
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toFrame(
  summary: string,
  entityType: string | null,
  entityId: string | null,
  category: string | undefined,
): WindowFrame {
  return {
    summary,
    category: category ?? "other",
    entityType: entityType as WindowFrame["entityType"] ?? undefined,
    entityId: entityId ?? undefined,
  };
}
