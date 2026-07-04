"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { habitSchema } from "../lib/schema";
import type { ActionResult, Habit, HabitWithCompletions } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createHabit(
  data: unknown,
): Promise<ActionResult<Habit>> {
  try {
    const userId = await requireUserId();
    const parsed = habitSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const habit = await prisma.habit.create({
      data: { ...parsed.data, userId },
    });

    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true, data: habit };
  } catch {
    return { success: false, error: "Failed to create habit" };
  }
}

export async function updateHabit(
  id: string,
  data: unknown,
): Promise<ActionResult<Habit>> {
  try {
    const userId = await requireUserId();
    const parsed = habitSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const habit = await prisma.habit.update({
      where: { id, userId },
      data: parsed.data,
    });

    revalidatePath("/habits");
    return { success: true, data: habit };
  } catch {
    return { success: false, error: "Failed to update habit" };
  }
}

export async function toggleHabitActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.habit.update({
      where: { id, userId },
      data: { isActive },
    });

    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update habit" };
  }
}

export async function deleteHabit(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.habit.delete({ where: { id, userId } });
    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete habit" };
  }
}

export async function toggleHabitCompletion(
  habitId: string,
  date: string,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const habit = await prisma.habit.findUnique({
      where: { id: habitId, userId },
    });
    if (!habit) return { success: false, error: "Habit not found" };

    const dateObj = new Date(date + "T00:00:00.000Z");
    const existing = await prisma.habitCompletion.findUnique({
      where: { habitId_date: { habitId, date: dateObj } },
    });

    if (existing) {
      await prisma.habitCompletion.delete({ where: { id: existing.id } });
    } else {
      await prisma.habitCompletion.create({ data: { habitId, date: dateObj } });
    }

    revalidatePath("/habits");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to toggle completion" };
  }
}

export async function getTodayHabits(): Promise<HabitWithCompletions[]> {
  const userId = await requireUserId();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return prisma.habit.findMany({
    where: { userId, isActive: true },
    include: {
      completions: {
        where: { date: { gte: today, lt: tomorrow } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getHabits(): Promise<HabitWithCompletions[]> {
  const userId = await requireUserId();
  return prisma.habit.findMany({
    where: { userId },
    include: {
      completions: { orderBy: { date: "desc" }, take: 30 },
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
}
