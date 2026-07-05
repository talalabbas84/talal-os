"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/types";
import type { MemoryImportance, ThoughtCategory } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getThoughts(input?: {
  query?: string;
  category?: ThoughtCategory | "ALL";
}) {
  const userId = await requireUserId();
  const query = input?.query?.trim();
  const category = input?.category && input.category !== "ALL" ? input.category : undefined;

  return prisma.thought.findMany({
    where: {
      userId,
      ...(category ? { category } : {}),
      ...(query
        ? {
            OR: [
              { rawText: { contains: query, mode: "insensitive" } },
              { cleanedText: { contains: query, mode: "insensitive" } },
              { summary: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
  });
}

export async function updateThoughtImportance(
  id: string,
  importance: MemoryImportance,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.thought.update({ where: { id, userId }, data: { importance } });
    revalidatePath("/thoughts");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update thought" };
  }
}

export async function deleteThought(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.thought.delete({ where: { id, userId } });
    revalidatePath("/thoughts");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete thought" };
  }
}
