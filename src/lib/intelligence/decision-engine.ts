// Decision Engine — the core orchestrator of the intelligence pipeline.
//
// Flow:
//   text → Articulation Engine → Intent Router → Context Builder → (workflow) → Action Planner → PipelineResult
//
// Each intent routes to a different workflow.
// The engine never writes to the database — that is the execution engine's job.

import { getAIProvider } from "@/lib/ai/provider";
import { buildUserContext } from "@/lib/context/context-builder";
import { articulateCapture } from "./articulation-engine";
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
  planFromSmartCaptureShortcut,
} from "./action-planner";
import { planGrowthFromCapture, planGrowthFromText } from "./growth-engine";
import { isDirectCommand, planThoughtAndLearningFromCapture } from "./thought-learning-engine";
import { planFromThoughtUnits, splitThoughts } from "./thought-splitter";
import { planPersonalIntelligenceActions } from "./personal-intelligence";
import type { PipelineResult, IntentResult } from "./types";

// processCapture: main entry — classifies intent then runs the right workflow.
export async function processCapture(
  userId: string,
  text: string,
): Promise<PipelineResult> {
  const provider = getAIProvider();
  const thoughtUnits = splitThoughts(text);
  const thoughtUnitActions = planFromThoughtUnits(thoughtUnits);
  const articulation = await articulateCapture(text);
  const articulatedText = articulation.articulated;

  const shortcutActions = isStandaloneSmartShortcut(articulatedText)
    ? planFromSmartCaptureShortcut(articulatedText)
    : [];
  if (shortcutActions.length > 0) {
    const growthActions = await planGrowthFromText(userId, articulatedText);
    const baseActions = [...thoughtUnitActions, ...shortcutActions, ...growthActions];
    const personalIntelligenceActions = await planPersonalIntelligenceActions({
      userId,
      rawText: articulation.original,
      cleanedText: articulatedText,
      existingActions: baseActions,
    });
    return {
      articulation,
      intent: "UPDATE",
      intentResult: { intent: "UPDATE", confidence: "high", reason: "Smart capture shortcut detected." },
      commands: [],
      actions: [...baseActions, ...personalIntelligenceActions],
    };
  }

  // 1. Classify intent from the clarified capture (fast, minimal context)
  const intentResult: IntentResult = await routeIntent(articulatedText);

  // 2. Build full user context (needed by most workflows)
  const { prompt: contextPrompt } = await buildUserContext(userId);

  // 3. Route to the appropriate workflow
  switch (intentResult.intent) {
    case "UPDATE": {
      // User is reporting completion or requesting changes to existing data
      const capture = await provider.organizeCapture(articulatedText, contextPrompt);
      const commands = capture.data.commands;
      const growthActions = await planGrowthFromCapture(userId, articulatedText, capture);
      const thoughtLearningActions = planThoughtAndLearningFromCapture({
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
        skipThought: isDirectCommand(articulatedText, capture),
      });
      const baseActions = [...thoughtUnitActions, ...planFromCommands(commands), ...thoughtLearningActions, ...growthActions];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: "UPDATE",
        intentResult,
        commands,
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }

    case "DECISION": {
      const recommendation = await generateRecommendation(articulatedText, contextPrompt);
      const growthActions = await planGrowthFromText(userId, articulatedText);
      const baseActions = [...thoughtUnitActions, ...planFromRecommendation(recommendation), ...growthActions];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: "DECISION",
        intentResult,
        recommendation,
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }

    case "REFLECTION":
    case "JOURNAL": {
      const reflectionData = await provider.generateReflection(articulatedText);
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
      const growthActions = await planGrowthFromText(userId, articulatedText);
      const baseActions = [...thoughtUnitActions, ...planFromReflection(data), ...growthActions];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: intentResult.intent as "REFLECTION" | "JOURNAL",
        intentResult,
        reflectionData: data,
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }

    case "QUESTION": {
      const answer = await provider.answerQuestion(articulatedText, contextPrompt);
      const growthActions = await planGrowthFromText(userId, articulatedText);
      const baseActions = growthActions.length > 0
        ? [...thoughtUnitActions, ...growthActions]
        : thoughtUnitActions.length > 0
          ? thoughtUnitActions
          : [];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        existingActions: baseActions,
      });
      const actions = [...baseActions, ...personalIntelligenceActions];
      return {
        articulation,
        intent: "QUESTION",
        intentResult,
        answer,
        actions: actions.length > 0
          ? actions
          : [{ id: "noop-1", type: "NO_ACTION", label: "No changes needed", payload: {} }],
      };
    }

    case "PLAN": {
      const plan = await runPlanningEngine(userId);
      const growthActions = await planGrowthFromText(userId, articulatedText);
      const baseActions = [...thoughtUnitActions, ...planFromDailyPlan(plan), ...growthActions];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: "PLAN",
        intentResult,
        plan,
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }

    case "MEMORY": {
      // Pure memory extraction — no full organize
      const capture = await provider.organizeCapture(articulatedText, contextPrompt);
      const candidates = capture.data.memoryCandidates;
      const growthActions = await planGrowthFromCapture(userId, articulatedText, capture);
      const thoughtLearningActions = planThoughtAndLearningFromCapture({
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
      });
      const baseActions = [...thoughtUnitActions, ...planFromMemoryCandidates(candidates), ...thoughtLearningActions, ...growthActions];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: "MEMORY",
        intentResult,
        candidates,
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }

    case "CREATE":
    case "UNKNOWN":
    default: {
      // Full organize flow — returns rich structured data for the capture-view
      const capture = await provider.organizeCapture(articulatedText, contextPrompt);
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
        people: d.peopleUpdates.map((p) => p.confidence !== "low"),
        personInsights: d.peopleUpdates.map((p) =>
          p.insights.map((ins) => ins.confidence !== "LOW"),
        ),
        journal: !!(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow),
      };
      const growthActions = await planGrowthFromCapture(userId, articulatedText, capture);
      const thoughtLearningActions = planThoughtAndLearningFromCapture({
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
        skipThought: isDirectCommand(articulatedText, capture),
      });
      const baseActions = [
        ...thoughtUnitActions,
        ...planFromCapture(capture, defaultInclusion, {}),
        ...thoughtLearningActions,
        ...growthActions,
      ];
      const personalIntelligenceActions = await planPersonalIntelligenceActions({
        userId,
        rawText: articulation.original,
        cleanedText: articulatedText,
        capture,
        existingActions: baseActions,
      });
      return {
        articulation,
        intent: intentResult.intent as "CREATE" | "UNKNOWN",
        intentResult,
        capture,
        // Pre-computed actions from default inclusion — capture-view will recompute on save
        actions: [...baseActions, ...personalIntelligenceActions],
      };
    }
  }
}

function isStandaloneSmartShortcut(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (lower.length > 90) return false;
  return /\b(i am done|i'm done|im done|finished it|i finished it|done with it|not today|tomorrow|skip|later|reschedule|move it)\b/.test(lower);
}
