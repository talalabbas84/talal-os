"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processCapture as runPipeline } from "@/lib/intelligence/decision-engine";
import { executeActions } from "@/lib/intelligence/execution-engine";
import { createDayPulsesForToday } from "@/lib/jobs/day-pulse";
import type { ActionResult } from "@/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function generateTodayPulses(): Promise<ActionResult<number>> {
  try {
    const userId = await requireUserId();
    const created = await createDayPulsesForToday(userId);
    revalidatePulsePaths();
    return { success: true, data: created.length };
  } catch {
    return { success: false, error: "Failed to generate today's pulses" };
  }
}

export async function checkInNow(): Promise<ActionResult<string>> {
  try {
    const userId = await requireUserId();
    const pulse = await prisma.dayPulse.create({
      data: {
        userId,
        scheduledFor: new Date(),
        sentAt: new Date(),
        prompt: "What are you doing right now?",
      },
    });
    revalidatePulsePaths();
    return { success: true, data: pulse.id };
  } catch {
    return { success: false, error: "Failed to create check-in" };
  }
}

export async function submitPulseCapture(input: {
  pulseId?: string | null;
  text: string;
}): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const text = input.text.trim();
    if (text.length < 3) return { success: false, error: "Type what you are doing first." };

    const result = await runPipeline(userId, text);
    const approved = result.actions.filter((action) => action.type !== "NO_ACTION");
    if (approved.length > 0) await executeActions(userId, approved);

    const now = new Date();
    if (input.pulseId) {
      await prisma.dayPulse.update({
        where: { id: input.pulseId, userId },
        data: { status: "ANSWERED", answeredAt: now, sentAt: now },
      });
    } else {
      await prisma.dayPulse.create({
        data: {
          userId,
          scheduledFor: now,
          sentAt: now,
          answeredAt: now,
          status: "ANSWERED",
          prompt: "What are you doing right now?",
        },
      });
    }

    revalidatePulsePaths();
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to save check-in" };
  }
}

export async function skipPulse(id: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    await prisma.dayPulse.update({
      where: { id, userId },
      data: { status: "SKIPPED" },
    });
    revalidatePulsePaths();
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to skip pulse" };
  }
}

function revalidatePulsePaths() {
  revalidatePath("/");
  revalidatePath("/pulse");
  revalidatePath("/capture");
  revalidatePath("/thoughts");
  revalidatePath("/learn");
  revalidatePath("/tasks");
  revalidatePath("/habits");
  revalidatePath("/people");
  revalidatePath("/daily-log");
}
