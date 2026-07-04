"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { projectSchema } from "../lib/schema";
import type { ActionResult, Project, ProjectStatus } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createProject(
  data: unknown,
): Promise<ActionResult<Project>> {
  try {
    const userId = await requireUserId();
    const parsed = projectSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const project = await prisma.project.create({
      data: { ...parsed.data, userId },
    });

    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true, data: project };
  } catch {
    return { success: false, error: "Failed to create project" };
  }
}

export async function updateProject(
  id: string,
  data: unknown,
): Promise<ActionResult<Project>> {
  try {
    const userId = await requireUserId();
    const parsed = projectSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Validation error" };
    }

    const project = await prisma.project.update({
      where: { id, userId },
      data: parsed.data,
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    revalidatePath("/");
    return { success: true, data: project };
  } catch {
    return { success: false, error: "Failed to update project" };
  }
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.project.update({
      where: { id, userId },
      data: { status },
    });

    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to update status" };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.project.delete({ where: { id, userId } });
    revalidatePath("/projects");
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete project" };
  }
}

export async function getProjects(status?: ProjectStatus) {
  const userId = await requireUserId();
  return prisma.project.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { tasks: true } } },
  });
}

export async function getProject(id: string) {
  const userId = await requireUserId();
  return prisma.project.findUnique({
    where: { id, userId },
    include: {
      tasks: { orderBy: { createdAt: "desc" } },
    },
  });
}
