"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { memoryEntrySchema } from "../lib/schema";
import type { ActionResult } from "@/types";
import type { MemoryEntry } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getMemoryEntries(): Promise<MemoryEntry[]> {
  const userId = await requireUserId();
  return prisma.memoryEntry.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function createMemoryEntry(
  data: unknown,
): Promise<ActionResult<MemoryEntry>> {
  try {
    const userId = await requireUserId();
    const parsed = memoryEntrySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const entry = await prisma.memoryEntry.create({
      data: { ...parsed.data, userId, source: "MANUAL" },
    });
    revalidatePath("/memory");
    return { success: true, data: entry };
  } catch {
    return { success: false, error: "Failed to create memory" };
  }
}

export async function updateMemoryEntry(
  id: string,
  data: unknown,
): Promise<ActionResult<MemoryEntry>> {
  try {
    const userId = await requireUserId();
    const parsed = memoryEntrySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }
    const entry = await prisma.memoryEntry.update({
      where: { id, userId },
      data: parsed.data,
    });
    revalidatePath("/memory");
    return { success: true, data: entry };
  } catch {
    return { success: false, error: "Failed to update memory" };
  }
}

export async function deleteMemoryEntry(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.memoryEntry.delete({ where: { id, userId } });
    revalidatePath("/memory");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete memory" };
  }
}
