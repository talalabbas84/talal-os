"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";
import { captureOutputSchema } from "../lib/schema";
import type { ActionResult } from "@/types";
import type { CaptureOutput } from "@/lib/ai/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function processCapture(
  text: string,
): Promise<ActionResult<CaptureOutput>> {
  try {
    await requireUserId();
    if (!text || text.trim().length < 3) {
      return { success: false, error: "Please type something first." };
    }

    const provider = getAIProvider();
    const output = await provider.processCapture(text.trim());
    return { success: true, data: output };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process capture";
    return { success: false, error: message };
  }
}

export interface SaveResult {
  tasksCreated: number;
  ideasCreated: number;
  journalSaved: boolean;
  habitsUpdated: number;
  projectsCreated: number;
}

export async function saveCapture(
  rawOutput: unknown,
  projectNamesToCreate: string[],
): Promise<ActionResult<SaveResult>> {
  try {
    const userId = await requireUserId();
    const parsed = captureOutputSchema.safeParse(rawOutput);
    if (!parsed.success) {
      return { success: false, error: "Invalid capture data." };
    }

    const output = parsed.data;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let tasksCreated = 0;
    let ideasCreated = 0;
    let journalSaved = false;
    let habitsUpdated = 0;
    let projectsCreated = 0;

    // 1. Create confirmed projects first so tasks can link to them
    const createdProjects: Record<string, string> = {}; // name -> id
    for (const name of projectNamesToCreate) {
      const proj = output.projects.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (!proj) continue;
      const created = await prisma.project.create({
        data: {
          name: proj.name,
          description: proj.description || null,
          priority: proj.priority,
          userId,
        },
      });
      createdProjects[proj.name.toLowerCase()] = created.id;
      projectsCreated++;
    }

    // 2. Save tasks
    for (const task of output.tasks) {
      let projectId: string | null = null;
      if (task.projectName) {
        // Try existing project first
        const existing = await prisma.project.findFirst({
          where: { userId, name: { equals: task.projectName, mode: "insensitive" } },
        });
        projectId = existing?.id ?? createdProjects[task.projectName.toLowerCase()] ?? null;
      }

      await prisma.task.create({
        data: {
          title: task.title,
          description: task.description || null,
          priority: task.priority,
          dueDate: task.dueDate ? new Date(task.dueDate + "T00:00:00.000Z") : null,
          userId,
          projectId,
        },
      });
      tasksCreated++;
    }

    // 3. Save ideas to Inbox
    for (const idea of output.ideas) {
      await prisma.inboxEntry.create({
        data: {
          title: idea.title,
          description: idea.description || null,
          category: "IDEA",
          userId,
        },
      });
      ideasCreated++;
    }

    // 4. Upsert daily log (only if there's something to save)
    const { accomplished, distractedBy, improveTomorrow, feeling } = output.journal;
    const hasJournalContent = accomplished || distractedBy || improveTomorrow || feeling;
    if (hasJournalContent) {
      await prisma.dailyLog.upsert({
        where: { userId_date: { userId, date: today } },
        create: {
          userId,
          date: today,
          feeling: feeling || null,
          accomplished: accomplished || null,
          distracted: distractedBy || null,
          improve: improveTomorrow || null,
        },
        update: {
          ...(feeling && { feeling }),
          ...(accomplished && { accomplished }),
          ...(distractedBy && { distracted: distractedBy }),
          ...(improveTomorrow && { improve: improveTomorrow }),
        },
      });
      journalSaved = true;
    }

    // 5. Update habits (completed ones only — match by name)
    const completedHabits = output.habits.filter((h) => h.completed);
    if (completedHabits.length > 0) {
      const userHabits = await prisma.habit.findMany({ where: { userId, isActive: true } });
      for (const capturedHabit of completedHabits) {
        const match = userHabits.find(
          (h) => h.name.toLowerCase() === capturedHabit.name.toLowerCase(),
        );
        if (!match) continue;

        const existing = await prisma.habitCompletion.findUnique({
          where: { habitId_date: { habitId: match.id, date: today } },
        });
        if (!existing) {
          await prisma.habitCompletion.create({
            data: { habitId: match.id, date: today },
          });
          habitsUpdated++;
        }
      }
    }

    // Revalidate affected pages
    revalidatePath("/tasks");
    revalidatePath("/inbox");
    revalidatePath("/daily-log");
    revalidatePath("/habits");
    revalidatePath("/projects");
    revalidatePath("/");

    return {
      success: true,
      data: { tasksCreated, ideasCreated, journalSaved, habitsUpdated, projectsCreated },
    };
  } catch {
    return { success: false, error: "Failed to save. Please try again." };
  }
}
