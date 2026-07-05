// Decision Engine — the core orchestrator of the intelligence pipeline.
//
// Flow:
//   text → Intent Router → Context Builder → (workflow) → Action Planner → PipelineResult
//
// Each intent routes to a different workflow.
// The engine never writes to the database — that is the execution engine's job.

import { getAIProvider } from "@/lib/ai/provider";
import { buildUserContext } from "@/lib/context/context-builder";
import { routeIntent } from "./intent-router";
import { generateRecommendation } from "./recommendation-engine";
import { runPlanningEngine } from "./planning-engine";
import {
  planFromCapture,
  planFromCommands,
  planFromRecommendation,
  planFromReflection,
  planFromMemoryCandidates,
  planFromDailyPlan,
} from "./action-planner";
import type { PipelineResult, IntentResult } from "./types";

interface RunOptions {
  // For CREATE intent — passed from capture-view after user makes inclusion choices.
  // Not used during the initial process call; used when building final actions to save.
  inclusion?: {
    tasks: boolean[];
    ideas: boolean[];
    habits: boolean[];
    projects: boolean[];
    reminders: boolean[];
    memories: boolean[];
    commands: boolean[];
    journal: boolean;
  };
  memoryEdits?: Record<number, { title: string; content: string }>;
}

// processCapture: main entry — classifies intent then runs the right workflow.
export async function processCapture(
  userId: string,
  text: string,
): Promise<PipelineResult> {
  const provider = getAIProvider();

  // 1. Classify intent (fast, minimal context)
  const intentResult: IntentResult = await routeIntent(text);

  // 2. Build full user context (needed by most workflows)
  const { prompt: contextPrompt, raw: ctx } = await buildUserContext(userId);

  // 3. Route to the appropriate workflow
  switch (intentResult.intent) {
    case "UPDATE": {
      // User is reporting completion or requesting changes to existing data
      const capture = await provider.organizeCapture(text, contextPrompt);
      const commands = capture.data.commands;
      return {
        intent: "UPDATE",
        intentResult,
        commands,
        actions: planFromCommands(commands),
      };
    }

    case "DECISION": {
      const recommendation = await generateRecommendation(text, contextPrompt);
      return {
        intent: "DECISION",
        intentResult,
        recommendation,
        actions: planFromRecommendation(recommendation),
      };
    }

    case "REFLECTION":
    case "JOURNAL": {
      const reflectionData = await provider.generateReflection(text);
      const data = {
        reflection: reflectionData.reflection,
        journal: {
          feeling: reflectionData.journal.feeling || undefined,
          accomplished: reflectionData.journal.accomplished || undefined,
          distractedBy: reflectionData.journal.distractedBy || undefined,
          improveTomorrow: reflectionData.journal.improveTomorrow || undefined,
        },
        memoryCandidates: reflectionData.memoryCandidates,
      };
      return {
        intent: intentResult.intent as "REFLECTION" | "JOURNAL",
        intentResult,
        reflectionData: data,
        actions: planFromReflection(data),
      };
    }

    case "QUESTION": {
      const answer = await provider.answerQuestion(text, contextPrompt);
      return {
        intent: "QUESTION",
        intentResult,
        answer,
        actions: [{ id: "noop-1", type: "NO_ACTION", label: "No changes needed", payload: {} }],
      };
    }

    case "PLAN": {
      const plan = await runPlanningEngine(userId);
      return {
        intent: "PLAN",
        intentResult,
        plan,
        actions: planFromDailyPlan(plan),
      };
    }

    case "MEMORY": {
      // Pure memory extraction — no full organize
      const capture = await provider.organizeCapture(text, contextPrompt);
      const candidates = capture.data.memoryCandidates;
      return {
        intent: "MEMORY",
        intentResult,
        candidates,
        actions: planFromMemoryCandidates(candidates),
      };
    }

    case "CREATE":
    case "UNKNOWN":
    default: {
      // Full organize flow — returns rich structured data for the capture-view
      const capture = await provider.organizeCapture(text, contextPrompt);
      // Default inclusion (all high/medium confidence included; projects opt-in; memories by importance)
      const d = capture.data;
      const defaultInclusion = {
        tasks: d.tasks.map((t) => t.confidence !== "low"),
        ideas: d.ideas.map((i) => i.confidence !== "low"),
        habits: d.habits.map((h) => h.confidence !== "low"),
        projects: d.projects.map(() => false),
        reminders: d.reminders.map((r) => r.confidence !== "low"),
        memories: d.memoryCandidates.map((m) => m.importance === "PERMANENT" || m.importance === "HIGH"),
        commands: d.commands.map((c) => c.confidence !== "low"),
        journal: !!(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow),
      };
      return {
        intent: intentResult.intent as "CREATE" | "UNKNOWN",
        intentResult,
        capture,
        // Pre-computed actions from default inclusion — capture-view will recompute on save
        actions: planFromCapture(capture, defaultInclusion, {}),
      };
    }
  }
}
