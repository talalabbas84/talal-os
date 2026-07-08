// Pulls DB context to build personalized recommendations for an event.
// No AI calls — recommendations are derived entirely from stored data:
//   - Recent person interactions (for social events)
//   - Person memories (for social events)
//   - Personal patterns (behavioural insights like "speaks too fast")
//   - Memory entries (CURRENT_STATE / LIFE_PRINCIPLE)
//   - Learning items (for study/interview events)
//   - Activity logs (most recent relevant activity)

import { prisma } from "@/lib/prisma";
import type { PersonalInsightCategory } from "@prisma/client";
import type { ReadinessRecommendation } from "./readiness-types";
import type { EventCategory } from "./readiness-types";

interface RecommendationContext {
  userId: string;
  category: EventCategory;
  linkedPersonId?: string;
  linkedPersonName?: string;
}

export async function buildRecommendations(
  ctx: RecommendationContext,
): Promise<ReadinessRecommendation[]> {
  const recs: ReadinessRecommendation[] = [];

  const [personRecs, patternRecs, memoryRecs, learningRecs] = await Promise.all([
    ctx.linkedPersonId ? buildPersonRecs(ctx.userId, ctx.linkedPersonId, ctx.linkedPersonName) : Promise.resolve([]),
    buildPatternRecs(ctx.userId, ctx.category),
    buildMemoryRecs(ctx.userId, ctx.category),
    shouldFetchLearning(ctx.category) ? buildLearningRecs(ctx.userId) : Promise.resolve([]),
  ]);

  recs.push(...personRecs);
  recs.push(...patternRecs);
  recs.push(...memoryRecs);
  recs.push(...learningRecs);

  return recs.slice(0, 3); // max 3 recommendations per spec
}

async function buildPersonRecs(
  userId: string,
  personId: string,
  personName?: string,
): Promise<ReadinessRecommendation[]> {
  const recs: ReadinessRecommendation[] = [];
  const name = personName ?? "them";

  const [interactions, memories] = await Promise.all([
    prisma.personInteraction.findMany({
      where: { userId, personId },
      orderBy: { date: "desc" },
      take: 2,
      select: { summary: true, topics: true, date: true },
    }),
    prisma.personMemory.findMany({
      where: { userId, personId, importance: { in: ["HIGH", "PERMANENT"] } },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { title: true, content: true },
    }),
  ]);

  if (interactions[0]) {
    const last = interactions[0];
    const topicSuffix = last.topics.length > 0 ? ` Topics: ${last.topics.slice(0, 2).join(", ")}.` : "";
    recs.push({
      text: `Last time with ${name}: ${last.summary.slice(0, 100)}${topicSuffix}`,
      context: `From your ${last.date} interaction`,
    });
  }

  if (memories[0]) {
    recs.push({
      text: memories[0].content.slice(0, 120),
      context: memories[0].title,
    });
  }

  return recs;
}

async function buildPatternRecs(
  userId: string,
  category: EventCategory,
): Promise<ReadinessRecommendation[]> {
  // Map event categories to relevant PersonalInsightCategory patterns
  const relevantCategories = getCategoryMapping(category);
  if (relevantCategories.length === 0) return [];

  const patterns = await prisma.personalPattern.findMany({
    where: {
      userId,
      category: { in: relevantCategories },
      confidence: { in: ["MEDIUM", "HIGH"] },
    },
    orderBy: { occurrences: "desc" },
    take: 2,
    select: { title: true, description: true },
  });

  return patterns.map((p) => ({
    text: p.description.slice(0, 120),
    context: p.title,
  }));
}

async function buildMemoryRecs(
  userId: string,
  category: EventCategory,
): Promise<ReadinessRecommendation[]> {
  // Only pull CURRENT_STATE or LIFE_PRINCIPLE memories for non-social events
  if (["dinner", "date", "networking"].includes(category)) return [];

  const memories = await prisma.memoryEntry.findMany({
    where: {
      userId,
      type: { in: ["CURRENT_STATE", "LIFE_PRINCIPLE"] },
      importance: { in: ["HIGH", "PERMANENT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { title: true, content: true },
  });

  return memories.map((m) => ({
    text: m.content.slice(0, 120),
    context: m.title,
  }));
}

async function buildLearningRecs(userId: string): Promise<ReadinessRecommendation[]> {
  const items = await prisma.learningItem.findMany({
    where: {
      userId,
      masteryLevel: { in: ["NEW", "LEARNING"] },
    },
    orderBy: { nextReviewAt: "asc" },
    take: 1,
    select: { title: true, content: true },
  });

  return items.map((i) => ({
    text: `Review: ${i.title} — ${i.content.slice(0, 80)}`,
    context: "From your learning items",
  }));
}

function getCategoryMapping(category: EventCategory): PersonalInsightCategory[] {
  switch (category) {
    case "presentation":
    case "interview":
      return ["COMMUNICATION", "EMOTIONAL"];
    case "dance_performance":
    case "dance_class":
      return ["HEALTH", "LEARNING", "EMOTIONAL"];
    case "networking":
      return ["COMMUNICATION", "RELATIONSHIP"];
    case "workout":
      return ["HEALTH"];
    case "meeting":
      return ["COMMUNICATION", "PRODUCTIVITY"];
    case "study":
      return ["LEARNING", "PRODUCTIVITY"];
    default:
      return [];
  }
}

function shouldFetchLearning(category: EventCategory): boolean {
  return ["interview", "presentation", "study"].includes(category);
}
