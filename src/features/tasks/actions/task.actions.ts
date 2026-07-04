"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { taskSchema } from "../lib/schema";
import type { ActionResult, TaskStatus, TaskWithProject } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createTask(
  data: unknown,
): Promise<ActionResult<TaskWithProject>> {
  try {
    const userId = await requireUserId();
    const parsed = taskSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const { dueDate, ...rest } = parsed.data;
    const task = await prisma.task.create({
      data: {
        ...rest,
        userId,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { project: true },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    if (task.projectId) revalidatePath(`/projects/${task.projectId}`);
    return { success: true, data: task };
  } catch {
    return { success: false, error: "Failed to create task" };
  }
}

export async function updateTask(
  id: string,
  data: unknown,
): Promise<ActionResult<TaskWithProject>> {
  try {
    const userId = await requireUserId();
    const parsed = taskSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const { dueDate, ...rest } = parsed.data;
    const task = await prisma.task.update({
      where: { id, userId },
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { project: true },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, data: task };
  } catch {
    return { success: false, error: "Failed to update task" };
  }
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.task.update({
      where: { id, userId },
      data: { status },
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update status" };
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.task.delete({ where: { id, userId } });
    revalidatePath("/tasks");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete task" };
  }
}

export async function getTasks(
  status?: TaskStatus,
): Promise<TaskWithProject[]> {
  const userId = await requireUserId();
  return prisma.task.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: { project: true },
  });
}

export async function getTodayTasks(): Promise<TaskWithProject[]> {
  const userId = await requireUserId();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.task.findMany({
    where: {
      userId,
      status: { not: "DONE" },
      OR: [
        { dueDate: { gte: today, lt: tomorrow } },
        { status: "IN_PROGRESS" },
      ],
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    include: { project: true },
  });
}
