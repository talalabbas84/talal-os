// Converts AI outputs into typed PlannedAction[].
// Never writes to the database — that is the execution engine's job.
// All action IDs are sequential strings (index-based) — stable for the session.

import type {
  PlannedAction,
  TaskPayload,
  IdeaPayload,
  MemoryPayload,
  ReminderPayload,
  EventPlaceholderPayload,
  FollowUpPayload,
  ProjectPayload,
  PersonUpdatePayload,
  PersonInsightPayload,
  Recommendation,
  ReflectionData,
  PlanSummary,
  ArticulationResult,
  ThoughtPayload,
  ActivityLogPayload,
  UserStatePayload,
} from "./types";
import type { HealthDetection } from "./health-state-detector";
import type {
  CaptureResult,
  CommandOutput,
  MemoryCandidateOutput,
  PersonUpdateOutput,
} from "@/lib/ai/types";

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

// ── From CREATE capture result ────────────────────────────────────────────────

export function planFromCapture(
  capture: CaptureResult,
  inclusion: {
    tasks: boolean[];
    ideas: boolean[];
    habits: boolean[];
    projects: boolean[];
    reminders: boolean[];
    events: boolean[];
    memories: boolean[];
    commands: boolean[];
    people: boolean[];
    personInsights: boolean[][];
    journal: boolean;
  },
  memoryEdits: Record<number, { title: string; content: string }>,
): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const d = capture.data;

  d.tasks.forEach((t, i) => {
    if (!inclusion.tasks[i]) return;
    const payload: TaskPayload = {
      title: t.title,
      description: t.description || undefined,
      priority: t.priority,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      timeContext: t.timeContext,
      needsReminder: t.needsReminder,
      importance: t.importance,
      urgency: t.urgency,
      energyRequired: t.energyRequired,
      projectName: t.projectName,
    };
    actions.push({ id: nextId("task"), type: "CREATE_TASK", label: `Add: ${t.title}`, payload });
  });

  d.ideas.forEach((idea, i) => {
    if (!inclusion.ideas[i]) return;
    const payload: IdeaPayload = { title: idea.title, description: idea.description || undefined, category: idea.category };
    actions.push({ id: nextId("idea"), type: "CREATE_IDEA", label: `Idea: ${idea.title}`, payload });
  });

  d.reminders.forEach((r, i) => {
    if (!inclusion.reminders[i]) return;
    const payload: ReminderPayload = { title: r.title, when: r.when };
    actions.push({ id: nextId("reminder"), type: "CREATE_REMINDER", label: `Reminder: ${r.title}`, payload });
    const followUpPayload: FollowUpPayload = {
      title: r.title,
      type: inferFollowUpType(r.title),
      dueDate: normalizeFollowUpDate(r.when),
      reason: r.when ? `Reminder requested for ${r.when}` : "Reminder captured.",
      createdFrom: "CAPTURE",
    };
    actions.push({ id: nextId("followup"), type: "CREATE_FOLLOW_UP", label: `Follow-up: ${r.title}`, payload: followUpPayload });
  });

  d.events.forEach((event, i) => {
    if (!inclusion.events[i] || !event.date) return;
    const payload: EventPlaceholderPayload = {
      title: event.title,
      description: event.description || null,
      date: event.date,
      time: event.time,
      timeContext: event.timeContext,
      location: event.location,
      relatedPersonName: event.relatedPersonName,
      needsReminder: event.needsReminder,
    };
    actions.push({
      id: nextId("event"),
      type: "CREATE_EVENT_PLACEHOLDER",
      label: `Create event placeholder: ${event.title}`,
      payload,
    });
  });

  d.projects.forEach((p, i) => {
    if (!inclusion.projects[i]) return;
    const payload: ProjectPayload = { name: p.name, description: p.description || undefined, priority: p.priority };
    actions.push({ id: nextId("project"), type: "CREATE_PROJECT", label: `Project: ${p.name}`, payload });
  });

  if (inclusion.journal) {
    const j = d.journal;
    if (j.feeling || j.accomplished || j.distractedBy || j.improveTomorrow) {
      actions.push({
        id: nextId("journal"),
        type: "UPDATE_JOURNAL",
        label: "Update daily log",
        payload: { feeling: j.feeling || undefined, accomplished: j.accomplished || undefined, distractedBy: j.distractedBy || undefined, improveTomorrow: j.improveTomorrow || undefined },
      });
    }
  }

  d.memoryCandidates.forEach((m, i) => {
    if (!inclusion.memories[i]) return;
    const edit = memoryEdits[i];
    const payload: MemoryPayload = {
      title: edit?.title ?? m.title,
      content: edit?.content ?? m.content,
      type: m.type,
      importance: m.importance,
      source: "CAPTURE",
    };
    actions.push({ id: nextId("memory"), type: "CREATE_MEMORY", label: `Memory: ${payload.title}`, payload });
  });

  d.commands.forEach((cmd, i) => {
    if (!inclusion.commands[i]) return;
    actions.push(...planFromCommand(cmd));
  });

  d.peopleUpdates.forEach((p, i) => {
    if (!inclusion.people[i]) return;
    const approvedInsights = p.insights.filter((_, j) => inclusion.personInsights[i]?.[j] ?? false);
    actions.push(...planFromPersonUpdate({ ...p, insights: approvedInsights }));
  });

  actions.push(...planSmartCaptureShortcuts(capture.reflection, d.summary));

  return actions;
}

// ── From UPDATE commands ──────────────────────────────────────────────────────

export function planFromCommands(commands: CommandOutput[]): PlannedAction[] {
  return commands.flatMap(planFromCommand);
}

export function planFromUnderstanding(articulation: ArticulationResult): PlannedAction[] {
  if (!articulation.original.trim() || !articulation.improvedArticulation.trim()) return [];

  return [
    {
      id: nextId("expr"),
      type: "CREATE_EXPRESSION_REWRITE",
      label: "Store capture understanding",
      payload: {
        rawText: articulation.original,
        articulatedText: articulation.articulated,
        improvedText: articulation.improvedArticulation,
        explanation: articulation.explanation,
        vocabularySuggestions: articulation.vocabularySuggestions,
        ambiguityNotes: articulation.ambiguityNotes,
        clarificationQuestion: articulation.clarificationQuestion,
      },
    },
    {
      id: nextId("expr-trend"),
      type: "CREATE_EXPRESSION_TREND",
      label: "Track capture understanding",
      payload: {
        ...articulation.expressionScore,
        notes: articulation.notes,
      },
    },
  ];
}

function planFromCommand(cmd: CommandOutput): PlannedAction[] {
  switch (cmd.type) {
    case "COMPLETE_TASK":
      return [{ id: nextId("cmd"), type: "COMPLETE_TASK", label: `Done: ${cmd.target}`, payload: { taskTitle: cmd.target } }];
    case "COMPLETE_HABIT":
      return [{ id: nextId("cmd"), type: "COMPLETE_HABIT", label: `Habit done: ${cmd.target}`, payload: { habitName: cmd.target } }];
    case "RESCHEDULE_TASK":
      return [{ id: nextId("cmd"), type: "RESCHEDULE_TASK", label: `Reschedule: ${cmd.target}${cmd.details ? ` → ${cmd.details}` : ""}`, payload: { taskTitle: cmd.target, details: cmd.details } }];
    case "ADD_REMINDER":
      return [
        { id: nextId("cmd"), type: "CREATE_REMINDER", label: `Reminder: ${cmd.target}`, payload: { title: cmd.target, when: cmd.details } },
        {
          id: nextId("followup"),
          type: "CREATE_FOLLOW_UP",
          label: `Follow-up: ${cmd.target}`,
          payload: {
            title: cmd.target,
            type: inferFollowUpType(cmd.target),
            dueDate: normalizeFollowUpDate(cmd.details),
            reason: cmd.details ? `Reminder requested for ${cmd.details}` : "Reminder command captured.",
            createdFrom: "CAPTURE",
          },
        },
      ];
  }
}

// ── From DECISION recommendation ─────────────────────────────────────────────

export function planFromRecommendation(recommendation: Recommendation): PlannedAction[] {
  const actions: PlannedAction[] = [];

  if (recommendation.suggestedMode === "RECOVERY") {
    actions.push({
      id: nextId("state"),
      type: "ENABLE_RECOVERY_MODE",
      label: "Enable recovery mode",
      payload: {},
    });
  }

  if (recommendation.suggestedMode) {
    actions.push({
      id: nextId("state"),
      type: "UPDATE_USER_STATE",
      label: `Set mode: ${recommendation.suggestedMode}`,
      payload: { recoveryMode: recommendation.suggestedMode === "RECOVERY" },
    });
  }

  if (!actions.length) {
    actions.push({ id: nextId("noop"), type: "NO_ACTION", label: "No changes — review recommendation", payload: {} });
  }

  return actions;
}

// ── From REFLECTION / JOURNAL ─────────────────────────────────────────────────

export function planFromReflection(data: ReflectionData): PlannedAction[] {
  const actions: PlannedAction[] = [];
  const j = data.journal;

  if (j.feeling || j.accomplished || j.distractedBy || j.improveTomorrow) {
    actions.push({
      id: nextId("journal"),
      type: "UPDATE_JOURNAL",
      label: "Save to daily log",
      payload: j,
    });
  }

  if (j.feeling) {
    actions.push({
      id: nextId("state"),
      type: "UPDATE_USER_STATE",
      label: "Update mood",
      payload: { currentMood: j.feeling, lastReflection: true },
    });
  }

  data.memoryCandidates.forEach((m) => {
    actions.push({
      id: nextId("memory"),
      type: "CREATE_MEMORY",
      label: `Memory: ${m.title}`,
      payload: { title: m.title, content: m.content, type: m.type, importance: m.importance, source: "CAPTURE" as const },
    });
  });

  if (!actions.length) {
    actions.push({ id: nextId("noop"), type: "NO_ACTION", label: "Reflection noted — nothing to save", payload: {} });
  }

  return actions;
}

// ── From MEMORY candidates ────────────────────────────────────────────────────

export function planFromMemoryCandidates(candidates: MemoryCandidateOutput[]): PlannedAction[] {
  return candidates.map((m) => ({
    id: nextId("memory"),
    type: "CREATE_MEMORY" as const,
    label: `Memory: ${m.title}`,
    payload: { title: m.title, content: m.content, type: m.type, importance: m.importance, source: "CAPTURE" as const },
  }));
}

// ── From PEOPLE updates ───────────────────────────────────────────────────────

export function planFromPersonUpdate(p: PersonUpdateOutput & { insights?: PersonInsightPayload[] }): PlannedAction[] {
  const payload: PersonUpdatePayload = {
    personName: p.personName,
    personData: p.personData,
    memories: p.memories,
    interaction: p.interaction,
    followUpTask: p.followUpTask,
    insights: p.insights ?? [],
  };
  return [{ id: nextId("person"), type: "CREATE_PERSON_UPDATE", label: `Person: ${p.personName}`, payload }];
}

// ── From PLAN ─────────────────────────────────────────────────────────────────

export function planFromDailyPlan(plan: PlanSummary): PlannedAction[] {
  const actions: PlannedAction[] = [];

  if (plan.topTasks[0]) {
    actions.push({
      id: nextId("state"),
      type: "UPDATE_USER_STATE",
      label: `Set mission: ${plan.topTasks[0].title}`,
      payload: { currentMission: plan.topTasks[0].title, lastPlanning: true },
    });
  }

  if (!actions.length) {
    actions.push({ id: nextId("noop"), type: "NO_ACTION", label: "Plan generated — no changes needed", payload: {} });
  }

  return actions;
}

export function planFromSmartCaptureShortcut(text: string): PlannedAction[] {
  const lower = text.trim().toLowerCase();
  const actions: PlannedAction[] = [];

  if (/\b(i am done|i'm done|im done|finished it|i finished it|done with it)\b/.test(lower)) {
    actions.push({
      id: nextId("shortcut"),
      type: "COMPLETE_TOP_TASK",
      label: "Mark current top task done",
      payload: {},
    });
  }

  if (/\b(not today|tomorrow|skip|later|reschedule|move it)\b/.test(lower)) {
    const dueDate = lower.includes("tomorrow") || lower.includes("not today") || lower.includes("skip") || lower.includes("later")
      ? dateISO(1)
      : null;

    actions.push({
      id: nextId("shortcut"),
      type: "RESCHEDULE_TOP_TASK",
      label: dueDate ? "Move current top task to tomorrow" : "Reschedule current top task",
      payload: {
        dueDate,
        reason: "Smart capture shortcut detected.",
      },
    });
  }

  return actions;
}

function planSmartCaptureShortcuts(reflection: string, summary: string): PlannedAction[] {
  const text = `${summary} ${reflection}`.toLowerCase();
  const actions: PlannedAction[] = [];

  if (/\b(not today|skip|later|tomorrow|reschedule)\b/.test(text)) {
    actions.push({
      id: nextId("followup"),
      type: "CREATE_FOLLOW_UP",
      label: "Follow up on deferred item",
      payload: {
        title: "Review deferred capture",
        type: "TASK",
        dueDate: text.includes("tomorrow") ? dateISO(1) : null,
        reason: "Capture included deferral language such as not today, skip, later, tomorrow, or reschedule.",
        createdFrom: "CAPTURE_SHORTCUT",
      },
    });
  }

  return actions;
}

// ── From health / current state capture ──────────────────────────────────────

export function planFromHealthState(rawText: string, health: HealthDetection): PlannedAction[] {
  const actions: PlannedAction[] = [];

  // Always log as a thought (HEALTH category) — captures the observation
  actions.push({
    id: nextId("health-thought"),
    type: "CREATE_THOUGHT",
    label: "Log health observation",
    payload: {
      rawText,
      cleanedText: rawText,
      summary: rawText.slice(0, 120),
      category: "HEALTH",
      importance: "MEDIUM",
      source: "CAPTURE",
    } satisfies ThoughtPayload,
  });

  if (health.type === "CURRENT_STATE" || health.type === "RECOVERY") {
    // Update user state with mood + energy
    const stateUpdate: Partial<UserStatePayload> = {};
    if (health.suggestedMood) stateUpdate.currentMood = health.suggestedMood;
    if (health.suggestedEnergyLevel) stateUpdate.energyLevel = health.suggestedEnergyLevel;

    if (Object.keys(stateUpdate).length > 0) {
      actions.push({
        id: nextId("health-state"),
        type: "UPDATE_USER_STATE",
        label: `Update state: ${health.suggestedMood ?? health.suggestedEnergyLevel}`,
        payload: stateUpdate as UserStatePayload,
      });
    }

    // Enter recovery mode if sick or exhausted
    if (health.suggestedRecoveryMode) {
      actions.push({
        id: nextId("health-recovery"),
        type: "ENABLE_RECOVERY_MODE",
        label: "Enter Recovery Mode",
        payload: {},
      });
    }

    // Log as activity
    actions.push({
      id: nextId("health-log"),
      type: "CREATE_ACTIVITY_LOG",
      label: "Log current state",
      payload: {
        activity: rawText.slice(0, 100),
        category: health.suggestedRecoveryMode ? "RECOVERY" : "REST",
        mood: health.suggestedMood,
        energyLevel: health.suggestedEnergyLevel,
      } satisfies ActivityLogPayload,
    });
  }

  if (health.type === "HEALTH_GOAL") {
    // Save as a health memory / goal
    actions.push({
      id: nextId("health-goal"),
      type: "CREATE_MEMORY",
      label: "Save health goal",
      payload: {
        title: rawText.slice(0, 80),
        content: rawText,
        type: "HEALTH_INSIGHT",
        importance: "HIGH",
        source: "CAPTURE",
      } satisfies MemoryPayload,
    });
  }

  return actions;
}

function inferFollowUpType(title: string): FollowUpPayload["type"] {
  const lower = title.toLowerCase();
  if (/\b(call|text|ask|message|email|meet|sara|sarah|person|friend|mom|dad)\b/.test(lower)) return "PERSON";
  if (/\b(gym|health|doctor|sick|sleep|workout|medicine)\b/.test(lower)) return "HEALTH";
  if (/\b(client|business|crm|project|invoice|lead)\b/.test(lower)) return "BUSINESS";
  return "TASK";
}

function normalizeFollowUpDate(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("tomorrow")) return dateISO(1);
  if (lower.includes("today") || lower.includes("tonight")) return dateISO(0);
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0]!;
  return null;
}

function dateISO(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split("T")[0]!;
}
