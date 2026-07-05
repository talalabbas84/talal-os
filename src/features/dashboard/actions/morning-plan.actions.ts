"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { generateDailyPlan } from "@/lib/planning/daily-plan";
import type { ActionResult } from "@/types";

export async function generateTodayPlan(): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    await generateDailyPlan(session.user.id);
    revalidatePath("/");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to generate today's plan" };
  }
}
