"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyLogSchema } from "../lib/schema";
import type { ActionResult, DailyLog } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function upsertDailyLog(
  data: unknown,
): Promise<ActionResult<DailyLog>> {
  try {
    const userId = await requireUserId();
    const parsed = dailyLogSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const { date, ...fields } = parsed.data;
    const dateObj = new Date(date + "T00:00:00.000Z");

    const log = await prisma.dailyLog.upsert({
      where: { userId_date: { userId, date: dateObj } },
      create: { userId, date: dateObj, ...fields },
      update: fields,
    });

    revalidatePath("/daily-log");
    return { success: true, data: log };
  } catch {
    return { success: false, error: "Failed to save daily log" };
  }
}

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const userId = await requireUserId();
  const dateObj = new Date(date + "T00:00:00.000Z");
  return prisma.dailyLog.findUnique({
    where: { userId_date: { userId, date: dateObj } },
  });
}

export async function getRecentDailyLogs(limit = 7): Promise<DailyLog[]> {
  const userId = await requireUserId();
  return prisma.dailyLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: limit,
  });
}
