"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inboxEntrySchema, updateInboxStatusSchema } from "../lib/schema";
import type { ActionResult, InboxEntry, InboxStatus } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createInboxEntry(
  data: unknown,
): Promise<ActionResult<InboxEntry>> {
  try {
    const userId = await requireUserId();
    const parsed = inboxEntrySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const entry = await prisma.inboxEntry.create({
      data: { ...parsed.data, userId },
    });

    revalidatePath("/inbox");
    revalidatePath("/");
    return { success: true, data: entry };
  } catch {
    return { success: false, error: "Failed to create entry" };
  }
}

export async function updateInboxEntry(
  id: string,
  data: unknown,
): Promise<ActionResult<InboxEntry>> {
  try {
    const userId = await requireUserId();
    const parsed = inboxEntrySchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const entry = await prisma.inboxEntry.update({
      where: { id, userId },
      data: parsed.data,
    });

    revalidatePath("/inbox");
    return { success: true, data: entry };
  } catch {
    return { success: false, error: "Failed to update entry" };
  }
}

export async function updateInboxStatus(
  id: string,
  status: InboxStatus,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = updateInboxStatusSchema.safeParse({ id, status });
    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    await prisma.inboxEntry.update({
      where: { id, userId },
      data: { status },
    });

    revalidatePath("/inbox");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update status" };
  }
}

export async function deleteInboxEntry(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.inboxEntry.delete({ where: { id, userId } });
    revalidatePath("/inbox");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete entry" };
  }
}

export async function getInboxEntries(status?: InboxStatus) {
  const userId = await requireUserId();
  return prisma.inboxEntry.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
}
