"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function saveDraft(text: string) {
  const userId = await requireUserId();
  const trimmed = text.trim();
  if (!trimmed) return { success: false as const, error: "Empty draft" };
  const draft = await prisma.captureDraft.create({ data: { userId, text: trimmed } });
  revalidatePath("/");
  return { success: true as const, data: draft };
}

export async function getDrafts() {
  const userId = await requireUserId();
  return prisma.captureDraft.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function deleteDraft(id: string) {
  const userId = await requireUserId();
  await prisma.captureDraft.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}
