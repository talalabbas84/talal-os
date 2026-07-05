"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";
import type { ReviewSelfRating } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const learningItemSchema = z.object({
  title: z.string().min(2),
  content: z.string().min(2),
  category: z.enum([
    "VOCABULARY",
    "DANCE",
    "PUBLIC_SPEAKING",
    "ACCENT",
    "SOFTWARE",
    "FINANCE",
    "FITNESS",
    "BOOK",
    "BUSINESS",
    "OTHER",
  ]),
  difficulty: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
});

export async function getDueLearningItems(userId: string, limit = 5) {
  const now = new Date();
  return prisma.learningItem.findMany({
    where: {
      userId,
      masteryLevel: { not: "MASTERED" },
      OR: [{ nextReviewAt: null }, { nextReviewAt: { lte: now } }],
    },
    orderBy: [{ nextReviewAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    take: limit,
  });
}

export async function createLearningItem(data: unknown): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = learningItemSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid learning item" };
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.learningItem.create({
      data: {
        userId,
        ...parsed.data,
        source: "MANUAL",
        masteryLevel: "NEW",
        nextReviewAt: tomorrow,
      },
    });

    revalidatePath("/learn");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to add learning item" };
  }
}

export async function submitReviewAnswer(input: {
  learningItemId: string;
  prompt: string;
  answer: string;
  selfRating: ReviewSelfRating;
}): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const item = await prisma.learningItem.findFirst({
      where: { id: input.learningItemId, userId },
    });
    if (!item) return { success: false, error: "Learning item not found" };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const session = await prisma.reviewSession.create({
      data: {
        userId,
        date: today,
        category: item.category,
        score: ratingScore(input.selfRating),
      },
    });

    await prisma.reviewAnswer.create({
      data: {
        reviewSessionId: session.id,
        learningItemId: item.id,
        prompt: input.prompt,
        answer: input.answer,
        selfRating: input.selfRating,
      },
    });

    await prisma.learningItem.update({
      where: { id: item.id },
      data: {
        lastReviewedAt: new Date(),
        nextReviewAt: nextReviewDate(input.selfRating),
        reviewCount: { increment: 1 },
        masteryLevel: masteryAfterReview(input.selfRating, item.reviewCount + 1),
      },
    });

    revalidatePath("/learn");
    revalidatePath("/learn/review");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to save review" };
  }
}

function nextReviewDate(rating: ReviewSelfRating): Date {
  const date = new Date();
  const days = rating === "AGAIN" ? 1 : rating === "HARD" ? 2 : rating === "GOOD" ? 4 : 7;
  date.setDate(date.getDate() + days);
  return date;
}

function masteryAfterReview(rating: ReviewSelfRating, reviewCount: number) {
  if (rating === "EASY" && reviewCount >= 4) return "MASTERED";
  if (rating === "GOOD" || rating === "EASY") return "REVIEWING";
  return "LEARNING";
}

function ratingScore(rating: ReviewSelfRating): number {
  if (rating === "EASY") return 4;
  if (rating === "GOOD") return 3;
  if (rating === "HARD") return 2;
  return 1;
}
