// Converts AI outputs into typed PlannedAction[].
// Never writes to the database — that is the execution engine's job.
// All action IDs are sequential strings (index-based) — stable for the session.

import type {
  PlannedAction,
  TaskPayload,
  IdeaPayload,
  MemoryPayload,
  ReminderPayload,
  ProjectPayload,
  Recommendation,
  ReflectionData,
  PlanSummary,
} from "./types";
import type {
  CaptureResult,
  CommandOutput,
  MemoryCandidateOutput,
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
    memories: boolean[];
    commands: boolean[];
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

  return actions;
}

// ── From UPDATE commands ──────────────────────────────────────────────────────

export function planFromCommands(commands: CommandOutput[]): PlannedAction[] {
  return commands.flatMap(planFromCommand);
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
      return [{ id: nextId("cmd"), type: "CREATE_REMINDER", label: `Reminder: ${cmd.target}`, payload: { title: cmd.target, when: cmd.details } }];
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
