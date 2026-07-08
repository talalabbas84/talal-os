"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { processCapture as runPipeline } from "@/lib/intelligence/decision-engine";
import { executeActions } from "@/lib/intelligence/execution-engine";
import { planFromCapture, planFromUnderstanding } from "@/lib/intelligence/action-planner";
import { planGrowthFromCapture } from "@/lib/intelligence/growth-engine";
import { isDirectCommand, planThoughtAndLearningFromCapture } from "@/lib/intelligence/thought-learning-engine";
import { planFromThoughtUnits, splitThoughts } from "@/lib/intelligence/thought-splitter";
import { planPersonalIntelligenceActions } from "@/lib/intelligence/personal-intelligence";
import type { ActionResult } from "@/types";
import type { PipelineResult, PlannedAction, ExecutionResult } from "@/lib/intelligence/types";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ── Step 1: Process capture through the full pipeline ─────────────────────────
// Classifies intent, builds context, runs the appropriate workflow.

export async function processCapture(
  text: string,
): Promise<ActionResult<PipelineResult>> {
  try {
    const userId = await requireUserId();
    if (!text || text.trim().length < 3) {
      return { success: false, error: "Please type something first." };
    }
    const result = await runPipeline(userId, text.trim());
    return { success: true, data: result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong. Try again.";
    return { success: false, error: message };
  }
}

// ── Step 2a: Save approved actions (non-CREATE intents) ───────────────────────
// The capture-view sends the approved PlannedAction[] directly.

export async function saveApprovedActions(
  actions: PlannedAction[],
): Promise<ActionResult<ExecutionResult>> {
  try {
    const userId = await requireUserId();
    if (!actions.length) return { success: false, error: "No actions to execute." };

    const result = await executeActions(userId, actions);
    revalidateAll();
    return { success: true, data: result };
  } catch {
    return { success: false, error: "Failed to save. Please try again." };
  }
}

// ── Step 2b: Save from CREATE inclusion state ─────────────────────────────────
// The capture-view sends the inclusion toggles + any memory edits.
// We recompute PlannedAction[] here so the payload is accurate.

export interface CreateSaveInput {
  capture: PipelineResult & { intent: "CREATE" | "UNKNOWN" };
  inclusion: {
    tasks: boolean[];
    ideas: boolean[];
    habits: boolean[];
    projects: boolean[];
    reminders: boolean[];
    memories: boolean[];
    commands: boolean[];
    people: boolean[];
    personInsights: boolean[][];
    journal: boolean;
  };
  memoryEdits: Record<number, { title: string; content: string }>;
}

export async function saveCreateCapture(
  input: CreateSaveInput,
): Promise<ActionResult<ExecutionResult>> {
  try {
    const userId = await requireUserId();
    const growthActions = await planGrowthFromCapture(userId, input.capture.articulation.articulated, input.capture.capture);
    const thoughtUnitActions = planFromThoughtUnits(splitThoughts(input.capture.articulation.original));
    const thoughtLearningActions = planThoughtAndLearningFromCapture({
      rawText: input.capture.articulation.original,
      cleanedText: input.capture.articulation.articulated,
      capture: input.capture.capture,
      skipThought: isDirectCommand(input.capture.articulation.articulated, input.capture.capture),
    });
    const baseActions = [
      ...planFromUnderstanding(input.capture.articulation),
      ...thoughtUnitActions,
      ...planFromCapture(input.capture.capture, input.inclusion, input.memoryEdits),
      ...thoughtLearningActions,
      ...growthActions,
    ];
    const personalIntelligenceActions = await planPersonalIntelligenceActions({
      userId,
      rawText: input.capture.articulation.original,
      cleanedText: input.capture.articulation.articulated,
      capture: input.capture.capture,
      existingActions: baseActions,
    });
    const actions = [...baseActions, ...personalIntelligenceActions];
    if (!actions.length) return { success: false, error: "Nothing selected to save." };

    const result = await executeActions(userId, actions);
    revalidateAll();
    return { success: true, data: result };
  } catch {
    return { success: false, error: "Failed to save. Please try again." };
  }
}

function revalidateAll() {
  revalidatePath("/tasks");
  revalidatePath("/inbox");
  revalidatePath("/daily-log");
  revalidatePath("/habits");
  revalidatePath("/projects");
  revalidatePath("/memory");
  revalidatePath("/people");
  revalidatePath("/thoughts");
  revalidatePath("/learn");
  revalidatePath("/pulse");
  revalidatePath("/capture");
  revalidatePath("/");
}
