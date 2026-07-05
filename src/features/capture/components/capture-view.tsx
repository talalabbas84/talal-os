"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  ListTodo,
  Lightbulb,
  BookOpen,
  Repeat2,
  FolderPlus,
  Bell,
  Brain,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Pencil,
  X,
  HelpCircle,
  TrendingUp,
  CalendarDays,
  Activity,
  Users,
} from "lucide-react";
import { processCapture, saveApprovedActions, saveCreateCapture } from "../actions/capture.actions";
import type { PipelineResult, PlannedAction, ExecutionResult } from "@/lib/intelligence/types";
import type { TaskOutput, IdeaOutput, HabitOutput, ProjectOutput, ReminderOutput, MemoryCandidateOutput, PersonUpdateOutput } from "@/lib/ai/types";
import { TYPE_LABELS, IMPORTANCE_STYLES } from "@/features/memory/components/memory-view";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "input" | "preview" | "saved";

// For CREATE intent — per-item inclusion toggles
interface CreateInclusion {
  tasks: boolean[];
  ideas: boolean[];
  habits: boolean[];
  projects: boolean[];
  reminders: boolean[];
  memories: boolean[];
  commands: boolean[];
  people: boolean[];
  personInsights: boolean[][];   // [personIndex][insightIndex]
  journal: boolean;
}

interface MemoryEdit {
  title: string;
  content: string;
}

// For non-CREATE intents — toggle planned actions by index
type ActionInclusion = boolean[];

// ── Root component ────────────────────────────────────────────────────────────

export function CaptureView({ userName, initialText = "" }: { userName: string; initialText?: string }) {
  const firstName = userName.split(" ")[0] ?? userName;

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState(initialText);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [createInclusion, setCreateInclusion] = useState<CreateInclusion | null>(null);
  const [memoryEdits, setMemoryEdits] = useState<Record<number, MemoryEdit>>({});
  const [actionInclusion, setActionInclusion] = useState<ActionInclusion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<ExecutionResult | null>(null);
  const [isProcessing, startProcessing] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleProcess() {
    setError(null);
    startProcessing(async () => {
      const res = await processCapture(text);
      if (!res.success) { setError(res.error); return; }

      const r = res.data;
      setMemoryEdits({});
      setPipelineResult(r);

      if (r.intent === "CREATE" || r.intent === "UNKNOWN") {
        const d = r.capture.data;
        setCreateInclusion({
          tasks: d.tasks.map((t) => t.confidence !== "low"),
          ideas: d.ideas.map((i) => i.confidence !== "low"),
          habits: d.habits.map((h) => h.confidence !== "low"),
          projects: d.projects.map(() => false),
          reminders: d.reminders.map((rem) => rem.confidence !== "low"),
          memories: d.memoryCandidates.map((m) => m.importance === "PERMANENT" || m.importance === "HIGH"),
          commands: d.commands.map((c) => c.confidence !== "low"),
          people: d.peopleUpdates.map((p) => p.confidence !== "low"),
          personInsights: d.peopleUpdates.map((p) =>
            p.insights.map((ins) => ins.confidence !== "LOW"),
          ),
          journal: !!(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow),
        });
        setActionInclusion(null);
      } else {
        // All other intents: toggle planned actions by index
        // NO_ACTION starts excluded; everything else starts included
        setActionInclusion(r.actions.map((a) => a.type !== "NO_ACTION"));
        setCreateInclusion(null);
      }

      setStep("preview");
    });
  }

  function handleRetry() {
    setError(null);
    setStep("input");
    setPipelineResult(null);
    setCreateInclusion(null);
    setActionInclusion(null);
    setMemoryEdits({});
  }

  function toggleCreateItem(key: keyof Omit<CreateInclusion, "journal" | "personInsights">, index: number) {
    setCreateInclusion((prev) => {
      if (!prev) return prev;
      const arr = [...prev[key]];
      arr[index] = !arr[index];
      return { ...prev, [key]: arr };
    });
  }

  function togglePersonInsight(personIndex: number, insightIndex: number) {
    setCreateInclusion((prev) => {
      if (!prev) return prev;
      const outer = prev.personInsights.map((row) => [...row]);
      const row = outer[personIndex] ?? [];
      row[insightIndex] = !row[insightIndex];
      outer[personIndex] = row;
      return { ...prev, personInsights: outer };
    });
  }

  function toggleAction(index: number) {
    setActionInclusion((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  function handleMemorySaveEdit(i: number, title: string, content: string) {
    setMemoryEdits((prev) => ({ ...prev, [i]: { title, content } }));
  }

  function handleSave() {
    if (!pipelineResult) return;
    setError(null);

    startSaving(async () => {
      let res: Awaited<ReturnType<typeof saveApprovedActions>>;

      if ((pipelineResult.intent === "CREATE" || pipelineResult.intent === "UNKNOWN") && createInclusion) {
        res = await saveCreateCapture({
          capture: pipelineResult as PipelineResult & { intent: "CREATE" | "UNKNOWN" },
          inclusion: createInclusion,
          memoryEdits,
        });
      } else if (actionInclusion) {
        const approved: PlannedAction[] = pipelineResult.actions.filter((_, i) => !!actionInclusion[i]);
        res = await saveApprovedActions(approved);
      } else {
        setError("Nothing to save.");
        return;
      }

      if (!res.success) { setError(res.error); return; }
      setSaveResult(res.data);
      setStep("saved");
    });
  }

  function handleReset() {
    setStep("input");
    setText("");
    setPipelineResult(null);
    setCreateInclusion(null);
    setActionInclusion(null);
    setError(null);
    setSaveResult(null);
    setMemoryEdits({});
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === "saved" && saveResult) {
    return <SavedView result={saveResult} intent={pipelineResult?.intent} onReset={handleReset} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {step === "input" && (
        <InputView
          firstName={firstName}
          text={text}
          onTextChange={setText}
          onProcess={handleProcess}
          isProcessing={isProcessing}
          error={error}
          onDismissError={() => setError(null)}
        />
      )}

      {step === "preview" && pipelineResult && (
        <PreviewView
          result={pipelineResult}
          createInclusion={createInclusion}
          actionInclusion={actionInclusion}
          onToggleCreate={toggleCreateItem}
          onToggleCreateJournal={() => setCreateInclusion((p) => p && { ...p, journal: !p.journal })}
          onTogglePersonInsight={togglePersonInsight}
          onToggleAction={toggleAction}
          onMemorySaveEdit={handleMemorySaveEdit}
          onEdit={handleRetry}
          onSave={handleSave}
          isSaving={isSaving}
          error={error}
        />
      )}
    </div>
  );
}

// ── Input step ────────────────────────────────────────────────────────────────

function InputView({
  firstName, text, onTextChange, onProcess, isProcessing, error, onDismissError,
}: {
  firstName: string;
  text: string;
  onTextChange: (v: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
  error: string | null;
  onDismissError: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          What&apos;s on your mind, {firstName}?
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Just talk. Tasks, decisions, feelings, questions — the system decides what to do.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="e.g. I'm overwhelmed and don't know where to start. I finished the CRM bug. I need to call the accountant tomorrow."
        rows={8}
        disabled={isProcessing}
        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button onClick={onDismissError} className="mt-1 text-xs font-medium text-red-600 underline dark:text-red-400">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onProcess}
        disabled={isProcessing || text.trim().length < 3}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
          "bg-neutral-900 text-white hover:bg-neutral-700",
          "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {isProcessing ? (
          <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
        ) : (
          <><Sparkles className="h-4 w-4" />Process</>
        )}
      </button>
    </div>
  );
}

// ── Preview step ──────────────────────────────────────────────────────────────

function PreviewView({
  result, createInclusion, actionInclusion,
  onToggleCreate, onToggleCreateJournal, onTogglePersonInsight, onToggleAction, onMemorySaveEdit,
  onEdit, onSave, isSaving, error,
}: {
  result: PipelineResult;
  createInclusion: CreateInclusion | null;
  actionInclusion: ActionInclusion | null;
  onToggleCreate: (key: keyof Omit<CreateInclusion, "journal" | "personInsights">, index: number) => void;
  onToggleCreateJournal: () => void;
  onTogglePersonInsight: (personIndex: number, insightIndex: number) => void;
  onToggleAction: (index: number) => void;
  onMemorySaveEdit: (i: number, title: string, content: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const selectedCount = createInclusion
    ? createInclusion.tasks.filter(Boolean).length +
      createInclusion.ideas.filter(Boolean).length +
      createInclusion.habits.filter(Boolean).length +
      createInclusion.projects.filter(Boolean).length +
      createInclusion.reminders.filter(Boolean).length +
      createInclusion.memories.filter(Boolean).length +
      createInclusion.commands.filter(Boolean).length +
      createInclusion.people.filter(Boolean).length +
      createInclusion.personInsights.reduce((sum, row) => sum + row.filter(Boolean).length, 0) +
      (createInclusion.journal ? 1 : 0)
    : actionInclusion
    ? actionInclusion.filter(Boolean).length
    : 0;

  return (
    <div className="space-y-4">
      {/* Intent badge */}
      <IntentBadge intentResult={result.intentResult} />

      <ArticulationPanel articulation={result.articulation} />

      {/* Intent-specific preview */}
      {(result.intent === "CREATE" || result.intent === "UNKNOWN") && createInclusion && (
        <CreatePreview
          capture={result.capture}
          inclusion={createInclusion}
          onToggle={onToggleCreate}
          onToggleJournal={onToggleCreateJournal}
          onTogglePersonInsight={onTogglePersonInsight}
          onMemorySaveEdit={onMemorySaveEdit}
        />
      )}

      {result.intent === "UPDATE" && actionInclusion && (
        <UpdatePreview
          commands={result.commands}
          actions={result.actions}
          actionInclusion={actionInclusion}
          onToggleAction={onToggleAction}
        />
      )}

      {result.intent === "DECISION" && (
        <DecisionPreview
          recommendation={result.recommendation}
          actions={result.actions}
          actionInclusion={actionInclusion ?? []}
          onToggleAction={onToggleAction}
        />
      )}

      {(result.intent === "REFLECTION" || result.intent === "JOURNAL") && (
        <ReflectionPreview
          reflectionData={result.reflectionData}
          actions={result.actions}
          actionInclusion={actionInclusion ?? []}
          onToggleAction={onToggleAction}
        />
      )}

      {result.intent === "QUESTION" && (
        <QuestionPreview answer={result.answer} />
      )}

      {result.intent === "PLAN" && (
        <PlanPreview
          plan={result.plan}
          actions={result.actions}
          actionInclusion={actionInclusion ?? []}
          onToggleAction={onToggleAction}
        />
      )}

      {result.intent === "MEMORY" && actionInclusion && (
        <MemoryPreview
          candidates={result.candidates}
          actionInclusion={actionInclusion}
          onToggleAction={onToggleAction}
          onMemorySaveEdit={onMemorySaveEdit}
        />
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={isSaving || (result.intent !== "QUESTION" && selectedCount === 0)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {isSaving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          ) : result.intent === "QUESTION" ? (
            <><CheckCircle2 className="h-4 w-4" />Done</>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {result.intent === "DECISION" ? "Apply" : "Approve & Save"}
              {selectedCount > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs dark:bg-black/20">
                  {selectedCount}
                </span>
              )}
            </>
          )}
        </button>
        <button
          onClick={onEdit}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Intent badge ──────────────────────────────────────────────────────────────

const INTENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CREATE:     { label: "Creating",    icon: ListTodo,     color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  UPDATE:     { label: "Updating",    icon: Zap,          color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  MEMORY:     { label: "Memory",      icon: Brain,        color: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  DECISION:   { label: "Decision",    icon: TrendingUp,   color: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" },
  PLAN:       { label: "Planning",    icon: CalendarDays, color: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  QUESTION:   { label: "Question",    icon: HelpCircle,   color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400" },
  REFLECTION: { label: "Reflection",  icon: Activity,     color: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
  JOURNAL:    { label: "Journal",     icon: BookOpen,     color: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  UNKNOWN:    { label: "Processing",  icon: Sparkles,     color: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800" },
};

function IntentBadge({ intentResult }: { intentResult: { intent: string; confidence: string; reason: string } }) {
  const meta = INTENT_META[intentResult.intent] ?? INTENT_META["UNKNOWN"]!;
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", meta.color)}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
      {intentResult.confidence !== "high" && (
        <span className="text-xs text-neutral-400">{intentResult.reason}</span>
      )}
    </div>
  );
}

function ArticulationPanel({
  articulation,
}: {
  articulation: PipelineResult["articulation"];
}) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            AI Understanding
          </span>
        </div>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase text-neutral-500 dark:bg-neutral-800">
          {articulation.confidence}
        </span>
      </div>

      <div className="space-y-2">
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Original Capture
          </p>
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm leading-relaxed text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400">
            {articulation.original}
          </p>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Understood As
          </p>
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm font-medium leading-relaxed text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
            {articulation.articulated}
          </p>
        </div>
      </div>

      {articulation.notes && (
        <p className="text-xs text-neutral-400">{articulation.notes}</p>
      )}
    </div>
  );
}

// ── CREATE preview ────────────────────────────────────────────────────────────

function CreatePreview({
  capture, inclusion, onToggle, onToggleJournal, onTogglePersonInsight, onMemorySaveEdit,
}: {
  capture: import("@/lib/ai/types").CaptureResult;
  inclusion: CreateInclusion;
  onToggle: (key: keyof Omit<CreateInclusion, "journal" | "personInsights">, index: number) => void;
  onToggleJournal: () => void;
  onTogglePersonInsight: (personIndex: number, insightIndex: number) => void;
  onMemorySaveEdit: (i: number, title: string, content: string) => void;
}) {
  const d = capture.data;
  return (
    <div className="space-y-4">
      {/* AI Reflection */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">AI</span>
        </div>
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{capture.reflection}</p>
        {(d.mood || d.healthStatus) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.mood && <Chip color="blue">{d.mood}</Chip>}
            {d.healthStatus && <Chip color="amber">{d.healthStatus}</Chip>}
          </div>
        )}
      </div>

      {d.tasks.length > 0 && (
        <Section icon={ListTodo} title="Tasks" count={d.tasks.length}>
          {d.tasks.map((task, i) => (
            <ItemRow key={i} included={!!inclusion.tasks[i]} onToggle={() => onToggle("tasks", i)} confidence={task.confidence}>
              <TaskCard task={task} />
            </ItemRow>
          ))}
        </Section>
      )}

      {d.ideas.length > 0 && (
        <Section icon={Lightbulb} title="Ideas" count={d.ideas.length} note="→ Inbox">
          {d.ideas.map((idea, i) => (
            <ItemRow key={i} included={!!inclusion.ideas[i]} onToggle={() => onToggle("ideas", i)} confidence={idea.confidence}>
              <IdeaCard idea={idea} />
            </ItemRow>
          ))}
        </Section>
      )}

      {(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow || d.journal.distractedBy) && (
        <Section icon={BookOpen} title="Daily Log" note="→ Today's entry">
          <ItemRow included={inclusion.journal} onToggle={onToggleJournal} confidence="high">
            <JournalCard journal={d.journal} />
          </ItemRow>
        </Section>
      )}

      {d.habits.length > 0 && (
        <Section icon={Repeat2} title="Habits" note="Matched to existing habits">
          {d.habits.map((habit, i) => (
            <ItemRow key={i} included={!!inclusion.habits[i]} onToggle={() => onToggle("habits", i)} confidence={habit.confidence}>
              <HabitCard habit={habit} />
            </ItemRow>
          ))}
        </Section>
      )}

      {d.projects.length > 0 && (
        <Section icon={FolderPlus} title="Projects" note="Opt-in">
          {d.projects.map((project, i) => (
            <ItemRow key={i} included={!!inclusion.projects[i]} onToggle={() => onToggle("projects", i)} confidence={project.confidence} alwaysShowToggle>
              <ProjectCard project={project} />
            </ItemRow>
          ))}
        </Section>
      )}

      {d.reminders.length > 0 && (
        <Section icon={Bell} title="Reminders" note="→ Inbox">
          {d.reminders.map((reminder, i) => (
            <ItemRow key={i} included={!!inclusion.reminders[i]} onToggle={() => onToggle("reminders", i)} confidence={reminder.confidence}>
              <ReminderCard reminder={reminder} />
            </ItemRow>
          ))}
        </Section>
      )}

      {d.memoryCandidates.length > 0 && (
        <Section icon={Brain} title="Possible Memories" count={d.memoryCandidates.length} note="→ Memory Vault">
          {d.memoryCandidates.map((candidate, i) => (
            <ItemRow key={i} included={!!inclusion.memories[i]} onToggle={() => onToggle("memories", i)} confidence="high" alwaysShowToggle>
              <MemoryCandidateCard candidate={candidate} index={i} onSaveEdit={onMemorySaveEdit} />
            </ItemRow>
          ))}
        </Section>
      )}

      {d.commands.length > 0 && (
        <Section icon={Zap} title="Detected Actions" count={d.commands.length} note="Executes against existing data">
          {d.commands.map((cmd, i) => (
            <ItemRow key={i} included={!!inclusion.commands[i]} onToggle={() => onToggle("commands", i)} confidence={cmd.confidence} alwaysShowToggle>
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {cmd.type === "COMPLETE_TASK" ? `Done: ${cmd.target}`
                    : cmd.type === "COMPLETE_HABIT" ? `Habit: ${cmd.target}`
                    : cmd.type === "RESCHEDULE_TASK" ? `Reschedule: ${cmd.target}${cmd.details ? ` → ${cmd.details}` : ""}`
                    : `Reminder: ${cmd.target}`}
                </p>
              </div>
            </ItemRow>
          ))}
        </Section>
      )}

      {d.peopleUpdates.length > 0 && (
        <Section icon={Users} title="People" count={d.peopleUpdates.length} note="→ Relationship memory">
          {d.peopleUpdates.map((person, i) => (
            <ItemRow key={i} included={!!inclusion.people[i]} onToggle={() => onToggle("people", i)} confidence={person.confidence} alwaysShowToggle>
              <PersonUpdateCard
                person={person}
                insightInclusion={inclusion.personInsights[i] ?? []}
                onToggleInsight={(j) => onTogglePersonInsight(i, j)}
              />
            </ItemRow>
          ))}
        </Section>
      )}
    </div>
  );
}

// ── UPDATE preview ────────────────────────────────────────────────────────────

function UpdatePreview({
  actions, actionInclusion, onToggleAction,
}: {
  commands: import("@/lib/ai/types").CommandOutput[];
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  const executableCount = actions.filter((action) => action.type !== "NO_ACTION").length;

  return (
    <Section icon={Zap} title="Actions to Execute" count={executableCount} note="Matches existing tasks/habits">
      {actions.map((action, i) => (
        action.type !== "NO_ACTION" && (
          <ItemRow key={action.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)} confidence="high" alwaysShowToggle>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{action.label}</p>
          </ItemRow>
        )
      ))}
    </Section>
  );
}

// ── DECISION preview ──────────────────────────────────────────────────────────

function DecisionPreview({
  recommendation, actions, actionInclusion, onToggleAction,
}: {
  recommendation: import("@/lib/intelligence/types").Recommendation;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  const modeColors: Record<string, string> = {
    RECOVERY: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    FOCUS: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    NORMAL: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Recommendation</span>
          {recommendation.suggestedMode && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", modeColors[recommendation.suggestedMode] ?? "")}>
              {recommendation.suggestedMode}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{recommendation.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{recommendation.reasoning}</p>

        {recommendation.topTask && (
          <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
            <p className="text-xs text-neutral-500">Focus on</p>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{recommendation.topTask}</p>
          </div>
        )}

        {recommendation.thingsToIgnore.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-neutral-400">Safely ignore today</p>
            <div className="flex flex-wrap gap-1">
              {recommendation.thingsToIgnore.map((item, i) => (
                <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 line-through dark:bg-neutral-800">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggested actions */}
      {actions.some((a) => a.type !== "NO_ACTION") && (
        <Section icon={Zap} title="Suggested Actions" note="Apply to your state">
          {actions.map((action, i) => (
            action.type !== "NO_ACTION" && (
              <ItemRow key={action.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)} confidence="high" alwaysShowToggle>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{action.label}</p>
              </ItemRow>
            )
          ))}
        </Section>
      )}
    </div>
  );
}

// ── REFLECTION preview ────────────────────────────────────────────────────────

function ReflectionPreview({
  reflectionData, actions, actionInclusion, onToggleAction,
}: {
  reflectionData: import("@/lib/intelligence/types").ReflectionData;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Reflection</span>
        </div>
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{reflectionData.reflection}</p>
      </div>

      {(reflectionData.journal.feeling || reflectionData.journal.accomplished) && (
        <Section icon={BookOpen} title="Daily Log">
          <ItemRow included={actionInclusion[actions.findIndex((a) => a.type === "UPDATE_JOURNAL")] ?? true} onToggle={() => onToggleAction(actions.findIndex((a) => a.type === "UPDATE_JOURNAL"))} confidence="high">
            <JournalCard journal={{
              feeling: reflectionData.journal.feeling ?? "",
              accomplished: reflectionData.journal.accomplished ?? "",
              distractedBy: reflectionData.journal.distractedBy ?? "",
              improveTomorrow: reflectionData.journal.improveTomorrow ?? "",
            }} />
          </ItemRow>
        </Section>
      )}

      {actions.filter((a) => a.type !== "NO_ACTION" && a.type !== "UPDATE_JOURNAL").map((action) => (
        <div key={action.id} className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <ItemRow included={!!actionInclusion[actions.indexOf(action)]} onToggle={() => onToggleAction(actions.indexOf(action))} confidence="high" alwaysShowToggle>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{action.label}</p>
          </ItemRow>
        </div>
      ))}
    </div>
  );
}

// ── QUESTION preview ──────────────────────────────────────────────────────────

function QuestionPreview({ answer }: { answer: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-neutral-400" />
        <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Answer</span>
      </div>
      <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{answer}</p>
    </div>
  );
}

// ── PLAN preview ──────────────────────────────────────────────────────────────

function PlanPreview({
  plan, actions, actionInclusion, onToggleAction,
}: {
  plan: import("@/lib/intelligence/types").PlanSummary;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Today&apos;s Plan</span>
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{plan.suggestion}</p>

        {plan.topTasks.length > 0 && (
          <div className="mt-3 space-y-2">
            {plan.topTasks.map((task, i) => (
              <div key={task.id} className="flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-500 dark:bg-neutral-800">
                  {i + 1}
                </span>
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{task.title}</span>
              </div>
            ))}
          </div>
        )}

        {plan.habitsDue.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-neutral-400">Habits due</p>
            <div className="flex flex-wrap gap-1">
              {plan.habitsDue.map((h) => (
                <span key={h.id} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                  {h.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {plan.overdueCount > 0 && (
          <p className="mt-3 text-xs text-red-500">{plan.overdueCount} task{plan.overdueCount !== 1 ? "s" : ""} overdue</p>
        )}
      </div>

      {actions.some((a) => a.type !== "NO_ACTION") && (
        <Section icon={Zap} title="Apply to State">
          {actions.map((action, i) => (
            action.type !== "NO_ACTION" && (
              <ItemRow key={action.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)} confidence="high" alwaysShowToggle>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{action.label}</p>
              </ItemRow>
            )
          ))}
        </Section>
      )}
    </div>
  );
}

// ── MEMORY preview ────────────────────────────────────────────────────────────

function MemoryPreview({
  candidates, actionInclusion, onToggleAction, onMemorySaveEdit,
}: {
  candidates: MemoryCandidateOutput[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
  onMemorySaveEdit: (i: number, title: string, content: string) => void;
}) {
  return (
    <Section icon={Brain} title="Memory Candidates" count={candidates.length} note="→ Memory Vault">
      {candidates.map((candidate, i) => (
        <ItemRow key={i} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)} confidence="high" alwaysShowToggle>
          <MemoryCandidateCard candidate={candidate} index={i} onSaveEdit={onMemorySaveEdit} />
        </ItemRow>
      ))}
    </Section>
  );
}

// ── Saved step ────────────────────────────────────────────────────────────────

function SavedView({
  result, intent, onReset,
}: {
  result: ExecutionResult;
  intent: string | undefined;
  onReset: () => void;
}) {
  if (intent === "QUESTION") {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={onReset} className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800">
          Capture something else
        </button>
      </div>
    );
  }

  const lines: string[] = [
    result.tasksCreated > 0 && `${result.tasksCreated} task${result.tasksCreated !== 1 ? "s" : ""} added`,
    result.ideasCreated > 0 && `${result.ideasCreated} idea${result.ideasCreated !== 1 ? "s" : ""} saved to Inbox`,
    result.remindersCreated > 0 && `${result.remindersCreated} reminder${result.remindersCreated !== 1 ? "s" : ""} added`,
    result.followUpsCreated > 0 && `${result.followUpsCreated} follow-up${result.followUpsCreated !== 1 ? "s" : ""} created`,
    result.growthItemsCreated > 0 && `${result.growthItemsCreated} growth item${result.growthItemsCreated !== 1 ? "s" : ""} created`,
    result.questionsCreated > 0 && `${result.questionsCreated} question${result.questionsCreated !== 1 ? "s" : ""} queued`,
    result.questionsAnswered > 0 && `${result.questionsAnswered} question${result.questionsAnswered !== 1 ? "s" : ""} answered`,
    result.journalSaved && "Daily log updated",
    result.habitsUpdated > 0 && `${result.habitsUpdated} habit${result.habitsUpdated !== 1 ? "s" : ""} recorded`,
    result.projectsCreated > 0 && `${result.projectsCreated} project${result.projectsCreated !== 1 ? "s" : ""} created`,
    result.memoriesSaved > 0 && `${result.memoriesSaved} memor${result.memoriesSaved !== 1 ? "ies" : "y"} saved`,
    result.commandsExecuted > 0 && `${result.commandsExecuted} action${result.commandsExecuted !== 1 ? "s" : ""} executed`,
    result.peopleUpdated > 0 && `${result.peopleUpdated} person record${result.peopleUpdated !== 1 ? "s" : ""} updated`,
    result.insightsSaved > 0 && `${result.insightsSaved} insight${result.insightsSaved !== 1 ? "s" : ""} saved`,
    result.userStateUpdated && "State updated",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="font-medium text-green-800 dark:text-green-200">Done.</p>
        </div>
        {lines.length > 0 && (
          <ul className="mt-3 space-y-1 pl-8">
            {lines.map((line, i) => (
              <li key={i} className="text-sm text-green-700 dark:text-green-300">{line}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onReset}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        Capture something else
      </button>
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, count, note, children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-neutral-400" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">{count}</span>
          )}
        </div>
        {note && <span className="text-xs text-neutral-400">{note}</span>}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</div>
    </div>
  );
}

function ItemRow({
  included, onToggle, confidence, alwaysShowToggle = false, children,
}: {
  included: boolean;
  onToggle: () => void;
  confidence: string;
  alwaysShowToggle?: boolean;
  children: React.ReactNode;
}) {
  const isLow = confidence === "low";
  const showCheckbox = alwaysShowToggle || isLow;

  return (
    <div className={cn("flex items-start gap-3 px-4 py-3 transition-opacity", !included && "opacity-40")}>
      {showCheckbox ? (
        <button
          onClick={onToggle}
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors",
            included ? "border-neutral-900 bg-neutral-900 dark:border-neutral-50 dark:bg-neutral-50"
                     : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900",
          )}
          aria-label={included ? "Exclude" : "Include"}
        >
          {included && (
            <svg viewBox="0 0 16 16" fill="none" className="h-full w-full p-0.5">
              <path d="M3 8l3.5 3.5L13 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-neutral-300 transition-colors hover:text-neutral-400" aria-label={included ? "Exclude" : "Include"}>
          {included ? <CheckCircle2 className="h-4 w-4 text-neutral-400" /> : <div className="h-4 w-4 rounded-full border-2 border-neutral-300" />}
        </button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {isLow && <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">low</span>}
      {confidence === "medium" && <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">~</span>}
    </div>
  );
}

// ── Card components ───────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  LOW: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  MEDIUM: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  HIGH: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
};
const IMPORTANCE_COLORS: Record<string, string> = {
  LOW: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  MEDIUM: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  HIGH: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};
const ENERGY_COLORS: Record<string, string> = {
  LOW: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  MEDIUM: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  HIGH: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

function TaskCard({ task }: { task: TaskOutput }) {
  const timeLabel = [
    task.dueDate && formatDate(task.dueDate),
    task.dueTime,
    !task.dueDate && task.timeContext && task.timeContext.replace(/_/g, " "),
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{task.title}</p>
        {task.needsReminder && <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">🔔</span>}
      </div>
      {timeLabel && <p className="text-xs text-neutral-400">{timeLabel}</p>}
      <div className="flex flex-wrap gap-1">
        <MetaBadge label="U" value={task.urgency} colors={URGENCY_COLORS} title="Urgency" />
        <MetaBadge label="I" value={task.importance} colors={IMPORTANCE_COLORS} title="Importance" />
        <MetaBadge label="E" value={task.energyRequired} colors={ENERGY_COLORS} title="Energy" />
        {task.projectName && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">{task.projectName}</span>}
      </div>
    </div>
  );
}

function MetaBadge({ label, value, colors, title }: { label: string; value: string; colors: Record<string, string>; title: string }) {
  if (value === "MEDIUM") return null;
  return (
    <span title={`${title}: ${value}`} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", colors[value] ?? "bg-neutral-100 text-neutral-500")}>
      {label}:{value[0]}
    </span>
  );
}

function IdeaCard({ idea }: { idea: IdeaOutput }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{idea.title}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{idea.category}</p>
    </div>
  );
}

function JournalCard({ journal }: { journal: { feeling: string; accomplished: string; improveTomorrow: string; distractedBy: string } }) {
  return (
    <dl className="space-y-1 text-sm">
      {journal.feeling && <JournalRow label="Feeling" value={journal.feeling} />}
      {journal.accomplished && <JournalRow label="Done" value={journal.accomplished} />}
      {journal.distractedBy && <JournalRow label="Distracted" value={journal.distractedBy} />}
      {journal.improveTomorrow && <JournalRow label="Tomorrow" value={journal.improveTomorrow} />}
    </dl>
  );
}

function HabitCard({ habit }: { habit: HabitOutput }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className={cn("h-2 w-2 rounded-full", habit.completed ? "bg-green-500" : "bg-neutral-300")} />
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{habit.name}</p>
        <span className="text-xs text-neutral-400">{habit.completed ? "completed" : "skipped"}</span>
      </div>
      {habit.note && <p className="ml-4 mt-0.5 text-xs text-neutral-400">{habit.note}</p>}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectOutput }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{project.name}</p>
      {project.description && <p className="mt-0.5 text-xs text-neutral-400">{project.description}</p>}
      <p className="mt-0.5 text-xs text-neutral-400">{project.priority} priority</p>
    </div>
  );
}

function ReminderCard({ reminder }: { reminder: ReminderOutput }) {
  return (
    <div>
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{reminder.title}</p>
      {reminder.when && <p className="mt-0.5 text-xs text-neutral-400">{reminder.when}</p>}
    </div>
  );
}

function MemoryCandidateCard({
  candidate, index, onSaveEdit,
}: {
  candidate: MemoryCandidateOutput;
  index: number;
  onSaveEdit: (i: number, title: string, content: string) => void;
}) {
  const [committed, setCommitted] = useState({ title: candidate.title, content: candidate.content });
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(candidate.title);
  const [editContent, setEditContent] = useState(candidate.content);

  function handleSave() {
    setCommitted({ title: editTitle, content: editContent });
    onSaveEdit(index, editTitle, editContent);
    setEditing(false);
  }
  function handleCancel() {
    setEditTitle(committed.title);
    setEditContent(committed.content);
    setEditing(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", IMPORTANCE_STYLES[candidate.importance as keyof typeof IMPORTANCE_STYLES] ?? "bg-neutral-100 text-neutral-500")}>
            {candidate.importance}
          </span>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
            {TYPE_LABELS[candidate.type as keyof typeof TYPE_LABELS] ?? candidate.type}
          </span>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="shrink-0 text-neutral-300 transition-colors hover:text-neutral-500" aria-label="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-50" />
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300" />
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-neutral-50 dark:text-neutral-900">
              <CheckCircle2 className="h-3 w-3" /> Save
            </button>
            <button onClick={handleCancel} className="flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 dark:border-neutral-600">
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{committed.title}</p>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{committed.content}</p>
          <p className="text-[10px] italic text-neutral-400">{candidate.reason}</p>
        </>
      )}
    </div>
  );
}

const PERSON_MEMORY_TYPE_LABELS: Record<string, string> = {
  BIRTHDAY: "Birthday", PREFERENCE: "Preference", STORY: "Story",
  BOUNDARY: "Boundary", COMMUNICATION_STYLE: "Comm Style",
  IMPORTANT_EVENT: "Event", FOLLOW_UP: "Follow Up", GENERAL: "Note",
};

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  COMMUNICATION_STYLE: "Comm Style", SOCIAL_STYLE: "Social",
  POSSIBLE_VALUES: "Values", ENERGY_PATTERN: "Energy",
  TRUST_PATTERN: "Trust", COMPATIBILITY_NOTE: "Compatibility",
  HOW_TO_APPROACH: "Approach", GENERAL: "General",
};

const INSIGHT_CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  MEDIUM: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  LOW: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function PersonUpdateCard({
  person,
  insightInclusion,
  onToggleInsight,
}: {
  person: PersonUpdateOutput;
  insightInclusion: boolean[];
  onToggleInsight: (insightIndex: number) => void;
}) {
  const pd = person.personData;
  const facts = [
    pd.relationshipType,
    pd.occupation,
    pd.birthday && `Birthday: ${pd.birthday}`,
    pd.hometown && `From ${pd.hometown}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{person.personName}</p>
        {facts.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {facts.map((f, i) => (
              <span key={i} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">{f}</span>
            ))}
          </div>
        )}
      </div>
      {person.memories.length > 0 && (
        <div className="space-y-1">
          {person.memories.map((mem, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 rounded bg-purple-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                {PERSON_MEMORY_TYPE_LABELS[mem.type] ?? mem.type}
              </span>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">{mem.content}</p>
            </div>
          ))}
        </div>
      )}
      {person.interaction && (
        <p className="text-xs text-neutral-400">{person.interaction.summary}</p>
      )}
      {person.followUpTask && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Follow-up: {person.followUpTask.title}</p>
      )}
      {person.insights.length > 0 && (
        <div className="mt-2 space-y-1.5 border-t border-neutral-100 pt-2 dark:border-neutral-800">
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">AI Insights</p>
          {person.insights.map((ins, j) => (
            <div
              key={j}
              className={cn("flex items-start gap-2 rounded-lg p-2 transition-opacity",
                insightInclusion[j] ? "bg-neutral-50 dark:bg-neutral-800/50" : "opacity-40",
              )}
            >
              <button
                onClick={() => onToggleInsight(j)}
                className={cn(
                  "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border transition-colors",
                  insightInclusion[j]
                    ? "border-neutral-900 bg-neutral-900 dark:border-neutral-50 dark:bg-neutral-50"
                    : "border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900",
                )}
                aria-label={insightInclusion[j] ? "Exclude insight" : "Include insight"}
              >
                {insightInclusion[j] && (
                  <svg viewBox="0 0 16 16" fill="none" className="h-full w-full p-0.5">
                    <path d="M3 8l3.5 3.5L13 4.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider", INSIGHT_CONFIDENCE_STYLES[ins.confidence] ?? "")}>
                    {ins.confidence}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500 dark:bg-neutral-800">
                    {INSIGHT_TYPE_LABELS[ins.type] ?? ins.type}
                  </span>
                </div>
                <p className="text-xs font-medium text-neutral-900 dark:text-neutral-50">{ins.title}</p>
                <p className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">{ins.content}</p>
                {ins.evidence.length > 0 && (
                  <p className="text-[10px] italic text-neutral-400">
                    Evidence: {ins.evidence.map((e) => `"${e}"`).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function JournalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
  );
}

function Chip({ color, children }: { color: "blue" | "amber"; children: React.ReactNode }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
      color === "blue" && "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      color === "amber" && "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    )}>
      {children}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "today";
  if (d.toDateString() === tomorrow.toDateString()) return "tomorrow";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
