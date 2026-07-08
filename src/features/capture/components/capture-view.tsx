"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Pencil,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import { processCapture, saveApprovedActions, saveCreateCapture } from "../actions/capture.actions";
import { saveDraft, getDrafts, deleteDraft } from "../actions/draft.actions";
import type { PipelineResult, PlannedAction, ExecutionResult } from "@/lib/intelligence/types";
import type { EventPlaceholderOutput, MemoryCandidateOutput, PersonUpdateOutput } from "@/lib/ai/types";
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
  events: boolean[];
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

// ── Draft type ────────────────────────────────────────────────────────────────

interface Draft {
  id: string;
  text: string;
  createdAt: Date;
}

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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isSavingDraft, startSavingDraft] = useTransition();

  useEffect(() => {
    getDrafts().then((ds) =>
      setDrafts(ds.map((d: { id: string; text: string; createdAt: Date }) => ({ id: d.id, text: d.text, createdAt: d.createdAt }))),
    );
  }, []);

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
          events: d.events.map((event) => event.confidence !== "low" && !!event.date),
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

  function handleSaveDraft() {
    if (text.trim().length < 3) return;
    startSavingDraft(async () => {
      const res = await saveDraft(text);
      if (res.success) {
        setDrafts((prev) => [{ id: res.data.id, text: res.data.text, createdAt: res.data.createdAt }, ...prev]);
        setText("");
      }
    });
  }

  function handleLoadDraft(draft: Draft) {
    setText(draft.text);
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    deleteDraft(draft.id);
  }

  function handleDeleteDraft(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    deleteDraft(id);
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
          drafts={drafts}
          onSaveDraft={handleSaveDraft}
          onLoadDraft={handleLoadDraft}
          onDeleteDraft={handleDeleteDraft}
          isSavingDraft={isSavingDraft}
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
          onCancel={handleReset}
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
  drafts, onSaveDraft, onLoadDraft, onDeleteDraft, isSavingDraft,
}: {
  firstName: string;
  text: string;
  onTextChange: (v: string) => void;
  onProcess: () => void;
  isProcessing: boolean;
  error: string | null;
  onDismissError: () => void;
  drafts: Draft[];
  onSaveDraft: () => void;
  onLoadDraft: (draft: Draft) => void;
  onDeleteDraft: (id: string) => void;
  isSavingDraft: boolean;
}) {
  const hasText = text.trim().length >= 3;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          What&apos;s on your mind, {firstName}?
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Just talk. Tasks, decisions, feelings, questions — I&apos;ll sort it out.
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

      <div className="flex items-center gap-3">
        <button
          onClick={onProcess}
          disabled={isProcessing || !hasText}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {isProcessing ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
          ) : (
            <><Sparkles className="h-4 w-4" />Continue</>
          )}
        </button>

        {hasText && (
          <button
            onClick={onSaveDraft}
            disabled={isSavingDraft || isProcessing}
            title="Save as draft — come back to it later"
            className={cn(
              "flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-3 text-sm text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-700",
              "dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-200",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          </button>
        )}
      </div>

      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Saved drafts</p>
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="flex items-center gap-2 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <button
                onClick={() => onLoadDraft(draft)}
                className="min-w-0 flex-1 text-left text-sm text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
              >
                <span className="block truncate">{draft.text.slice(0, 80)}{draft.text.length > 80 ? "…" : ""}</span>
              </button>
              <button
                onClick={() => onDeleteDraft(draft.id)}
                className="shrink-0 text-neutral-300 hover:text-red-400 dark:text-neutral-600 dark:hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Preview step ──────────────────────────────────────────────────────────────

function PreviewView({
  result, createInclusion, actionInclusion,
  onToggleCreate, onToggleCreateJournal, onTogglePersonInsight, onToggleAction, onMemorySaveEdit,
  onEdit, onSave, onCancel, isSaving, error,
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
  onCancel: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const selectedCount = createInclusion
    ? createInclusion.tasks.filter(Boolean).length +
      createInclusion.ideas.filter(Boolean).length +
      createInclusion.habits.filter(Boolean).length +
      createInclusion.projects.filter(Boolean).length +
      createInclusion.reminders.filter(Boolean).length +
      createInclusion.events.filter(Boolean).length +
      createInclusion.memories.filter(Boolean).length +
      createInclusion.commands.filter(Boolean).length +
      createInclusion.people.filter(Boolean).length +
      createInclusion.personInsights.reduce((sum, row) => sum + row.filter(Boolean).length, 0) +
      (createInclusion.journal ? 1 : 0)
    : actionInclusion
    ? actionInclusion.filter(Boolean).length
    : 0;

  const isQuestion = result.intent === "QUESTION";
  const canSave = isQuestion || selectedCount > 0 || hasNoCreatePreviewContent(result);
  return (
    <div className="space-y-4">
      <PreviewBlock title="I understood">
        <UnderstandingText result={result} />
      </PreviewBlock>

      <PreviewBlock title="I'll do this">
        {(result.intent === "CREATE" || result.intent === "UNKNOWN") && createInclusion && (
          <AssistantPlanView
            capture={result.capture}
            inclusion={createInclusion}
            onToggle={onToggleCreate}
            onToggleJournal={onToggleCreateJournal}
            onTogglePersonInsight={onTogglePersonInsight}
            onMemorySaveEdit={onMemorySaveEdit}
          />
        )}

        {result.intent === "UPDATE" && actionInclusion && (
          <UpdatePlanView
            actions={result.actions}
            actionInclusion={actionInclusion}
            onToggleAction={onToggleAction}
          />
        )}

        {result.intent === "DECISION" && (
          <DecisionPlanView
            recommendation={result.recommendation}
            actions={result.actions}
            actionInclusion={actionInclusion ?? []}
            onToggleAction={onToggleAction}
          />
        )}

        {(result.intent === "REFLECTION" || result.intent === "JOURNAL") && (
          <ReflectionPlanView
            reflectionData={result.reflectionData}
            actions={result.actions}
            actionInclusion={actionInclusion ?? []}
            onToggleAction={onToggleAction}
          />
        )}

        {result.intent === "QUESTION" && (
          <QuestionView answer={result.answer} />
        )}

        {result.intent === "PLAN" && (
          <DailyPlanView
            plan={result.plan}
            actions={result.actions}
            actionInclusion={actionInclusion ?? []}
            onToggleAction={onToggleAction}
          />
        )}

        {result.intent === "MEMORY" && actionInclusion && (
          <MemoryPlanView
            candidates={result.candidates}
            actionInclusion={actionInclusion}
            onToggleAction={onToggleAction}
            onMemorySaveEdit={onMemorySaveEdit}
          />
        )}
      </PreviewBlock>

      {result.articulation?.clarificationQuestion && (
        <PreviewBlock title="One question">
          <ClarificationBlock question={result.articulation.clarificationQuestion} />
        </PreviewBlock>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={isSaving || !canSave}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {isSaving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" />Looks Good</>
          )}
        </button>
        <button
          onClick={onEdit}
          disabled={isSaving}
          className="flex items-center justify-center rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Make One Change
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex items-center justify-center px-3 py-3 text-sm text-neutral-400 transition-colors hover:text-neutral-600 disabled:opacity-40 dark:hover:text-neutral-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Invisible preview primitives ──────────────────────────────────────────────

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-neutral-400">{title}</h2>
      {children}
    </section>
  );
}

function UnderstandingText({ result }: { result: PipelineResult }) {
  const understanding = buildUnderstanding(result);
  return (
    <p className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      {understanding}
    </p>
  );
}

function buildUnderstanding(result: PipelineResult): string {
  const text = result.articulation?.articulated?.trim();
  if (text) return text;

  if (result.intent === "DECISION") return result.recommendation.summary;
  if (result.intent === "QUESTION") return "You asked a question.";
  if (result.intent === "PLAN") return "You want a plan.";
  if (result.intent === "MEMORY") return "You shared something worth remembering.";
  if (result.intent === "REFLECTION" || result.intent === "JOURNAL") return result.reflectionData.reflection;

  return "I understood your capture.";
}

function ClarificationBlock({ question }: { question: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">{question}</p>
    </div>
  );
}

function hasNoCreatePreviewContent(result: PipelineResult): boolean {
  if (result.intent !== "CREATE" && result.intent !== "UNKNOWN") return false;
  const d = result.capture.data;
  return !(
    d.tasks.length > 0 || d.ideas.length > 0 || d.habits.length > 0 ||
    d.projects.length > 0 || d.reminders.length > 0 || d.events.length > 0 ||
    d.memoryCandidates.length > 0 || d.commands.length > 0 || d.peopleUpdates.length > 0 ||
    d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow || d.journal.distractedBy
  );
}

// ── Shared plan primitives ────────────────────────────────────────────────────

function PlanSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      {children}
    </div>
  );
}

function PlanItem({
  included, onToggle, children,
}: {
  included: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start gap-3 px-4 py-2.5 transition-opacity", !included && "opacity-40")}>
      <button
        onClick={onToggle}
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors",
          included
            ? "border-neutral-900 bg-neutral-900 dark:border-neutral-50 dark:bg-neutral-50"
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
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ── CREATE — assistant plan view ──────────────────────────────────────────────

function AssistantPlanView({
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
  const hasContent =
    d.tasks.length > 0 || d.ideas.length > 0 || d.habits.length > 0 ||
    d.projects.length > 0 || d.reminders.length > 0 || d.events.length > 0 || d.memoryCandidates.length > 0 ||
    d.commands.length > 0 || d.peopleUpdates.length > 0 ||
    !!(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow || d.journal.distractedBy);

  if (!hasContent) {
    return (
      <p className="py-2 text-sm text-neutral-400">
        Save this thought for later.
      </p>
    );
  }

  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      {d.tasks.length > 0 && (
        <PlanSection label="Create tasks">
          {d.tasks.map((task, i) => (
            <PlanItem key={i} included={!!inclusion.tasks[i]} onToggle={() => onToggle("tasks", i)}>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{task.title}</p>
              {(task.dueDate || task.dueTime || task.timeContext) && (
                <p className="mt-0.5 text-xs text-neutral-400">
                  {[task.dueDate && formatDate(task.dueDate), task.dueTime, !task.dueDate && task.timeContext?.replace(/_/g, " ")].filter(Boolean).join(" · ")}
                </p>
              )}
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.commands.length > 0 && (
        <PlanSection label="Update progress">
          {d.commands.map((cmd, i) => (
            <PlanItem key={i} included={!!inclusion.commands[i]} onToggle={() => onToggle("commands", i)}>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
                {cmd.type === "COMPLETE_TASK" ? `✓ ${cmd.target}`
                  : cmd.type === "COMPLETE_HABIT" ? `✓ ${cmd.target}`
                  : cmd.type === "RESCHEDULE_TASK" ? `Move: ${cmd.target}${cmd.details ? ` → ${cmd.details}` : ""}`
                  : `Remind: ${cmd.target}`}
              </p>
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.reminders.length > 0 && (
        <PlanSection label="Create reminders">
          {d.reminders.map((rem, i) => (
            <PlanItem key={i} included={!!inclusion.reminders[i]} onToggle={() => onToggle("reminders", i)}>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{rem.title}</p>
              {rem.when && <p className="mt-0.5 text-xs text-neutral-400">{rem.when}</p>}
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.events.length > 0 && (
        <PlanSection label="Create event placeholders">
          {d.events.map((event, i) => (
            <PlanItem key={i} included={!!inclusion.events[i]} onToggle={() => onToggle("events", i)}>
              <EventPlaceholderCard event={event} />
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.ideas.length > 0 && (
        <PlanSection label="Save ideas">
          {d.ideas.map((idea, i) => (
            <PlanItem key={i} included={!!inclusion.ideas[i]} onToggle={() => onToggle("ideas", i)}>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{idea.title}</p>
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.habits.length > 0 && (
        <PlanSection label="Update habits">
          {d.habits.map((habit, i) => (
            <PlanItem key={i} included={!!inclusion.habits[i]} onToggle={() => onToggle("habits", i)}>
              <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", habit.completed ? "bg-green-500" : "bg-neutral-300")} />
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{habit.name}</p>
                <span className="text-xs text-neutral-400">{habit.completed ? "done" : "skipped"}</span>
              </div>
              {habit.note && <p className="mt-0.5 text-xs text-neutral-400">{habit.note}</p>}
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.projects.length > 0 && (
        <PlanSection label="Create project">
          {d.projects.map((proj, i) => (
            <PlanItem key={i} included={!!inclusion.projects[i]} onToggle={() => onToggle("projects", i)}>
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{proj.name}</p>
              {proj.description && <p className="mt-0.5 text-xs text-neutral-400">{proj.description}</p>}
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.peopleUpdates.length > 0 && (
        <PlanSection label="Update people">
          {d.peopleUpdates.map((person, i) => (
            <PlanItem key={i} included={!!inclusion.people[i]} onToggle={() => onToggle("people", i)}>
              <PersonPlanCard
                person={person}
                insightInclusion={inclusion.personInsights[i] ?? []}
                onToggleInsight={(j) => onTogglePersonInsight(i, j)}
              />
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {d.memoryCandidates.length > 0 && (
        <PlanSection label="Save memories">
          {d.memoryCandidates.map((mem, i) => (
            <PlanItem key={i} included={!!inclusion.memories[i]} onToggle={() => onToggle("memories", i)}>
              <MemoryCandidateCard candidate={mem} index={i} onSaveEdit={onMemorySaveEdit} />
            </PlanItem>
          ))}
        </PlanSection>
      )}

      {(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow || d.journal.distractedBy) && (
        <PlanSection label="Update daily log">
          <PlanItem included={inclusion.journal} onToggle={onToggleJournal}>
            <JournalCard journal={d.journal} />
          </PlanItem>
        </PlanSection>
      )}
    </div>
  );
}

function PersonPlanCard({
  person, insightInclusion, onToggleInsight,
}: {
  person: PersonUpdateOutput;
  insightInclusion: boolean[];
  onToggleInsight: (j: number) => void;
}) {
  const pd = person.personData;
  const facts = [pd.relationshipType, pd.occupation, pd.birthday && `b. ${pd.birthday}`, pd.hometown].filter(Boolean) as string[];

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{person.personName}</p>
        {facts.map((f, i) => (
          <span key={i} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">{f}</span>
        ))}
      </div>
      {person.memories.length > 0 && (
        <div className="space-y-0.5">
          {person.memories.map((mem, i) => (
            <p key={i} className="text-xs text-neutral-500 dark:text-neutral-400">{mem.content}</p>
          ))}
        </div>
      )}
      {person.interaction?.summary && (
        <p className="text-xs text-neutral-400">{person.interaction.summary}</p>
      )}
      {person.followUpTask && (
        <p className="text-xs text-amber-600 dark:text-amber-400">Follow up: {person.followUpTask.title}</p>
      )}
      {person.insights.length > 0 && (
        <div className="space-y-1 border-t border-neutral-100 pt-1.5 dark:border-neutral-800">
          {person.insights.map((ins, j) => (
            <div key={j} className={cn("flex items-start gap-2 transition-opacity", !insightInclusion[j] && "opacity-40")}>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleInsight(j); }}
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
              <div className="min-w-0 flex-1">
                <p className="text-xs text-neutral-600 dark:text-neutral-400">{ins.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventPlaceholderCard({ event }: { event: EventPlaceholderOutput }) {
  const details = [
    event.date && formatDate(event.date),
    event.time,
    event.location,
    event.relatedPersonName && `with ${event.relatedPersonName}`,
    event.needsReminder && "reminder on",
  ].filter(Boolean);

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{event.title}</p>
      {details.length > 0 && (
        <p className="text-xs text-neutral-400">{details.join(" · ")}</p>
      )}
      {event.description && (
        <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{event.description}</p>
      )}
    </div>
  );
}

// ── UPDATE plan view ──────────────────────────────────────────────────────────

function UpdatePlanView({
  actions, actionInclusion, onToggleAction,
}: {
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  const visible = actions.map((a, i) => ({ a, i })).filter(({ a }) => isVisibleAction(a));
  if (visible.length === 0) return <p className="py-2 text-sm text-neutral-400">No changes to apply.</p>;
  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      <PlanSection label="Applying">
        {visible.map(({ a, i }) => (
          <PlanItem key={a.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)}>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{a.label}</p>
          </PlanItem>
        ))}
      </PlanSection>
    </div>
  );
}

// ── DECISION plan view ────────────────────────────────────────────────────────

function DecisionPlanView({
  recommendation, actions, actionInclusion, onToggleAction,
}: {
  recommendation: import("@/lib/intelligence/types").Recommendation;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{recommendation.summary}</p>
        {recommendation.reasoning && (
          <p className="mt-2 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{recommendation.reasoning}</p>
        )}
        {recommendation.topTask && (
          <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-800">
            <p className="text-xs text-neutral-400">Start with</p>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{recommendation.topTask}</p>
          </div>
        )}
        {recommendation.thingsToIgnore?.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs text-neutral-400">Safely skip today</p>
            <div className="flex flex-wrap gap-1">
              {recommendation.thingsToIgnore.map((item, i) => (
                <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-400 line-through dark:bg-neutral-800">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {actions.some(isVisibleAction) && (
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          <PlanSection label="Actions">
            {actions.map((a, i) => isVisibleAction(a) && (
              <PlanItem key={a.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)}>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{a.label}</p>
              </PlanItem>
            ))}
          </PlanSection>
        </div>
      )}
    </div>
  );
}

// ── REFLECTION plan view ──────────────────────────────────────────────────────

function ReflectionPlanView({
  reflectionData, actions, actionInclusion, onToggleAction,
}: {
  reflectionData: import("@/lib/intelligence/types").ReflectionData;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  const journalIdx = actions.findIndex((a) => a.type === "UPDATE_JOURNAL");
  const otherActions = actions.filter((a) => isVisibleAction(a) && a.type !== "UPDATE_JOURNAL");

  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      {reflectionData.reflection && (
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{reflectionData.reflection}</p>
        </div>
      )}
      {(reflectionData.journal.feeling || reflectionData.journal.accomplished) && (
        <PlanSection label="Daily log">
          <PlanItem included={journalIdx >= 0 ? (actionInclusion[journalIdx] ?? true) : true} onToggle={() => journalIdx >= 0 && onToggleAction(journalIdx)}>
            <JournalCard journal={{
              feeling: reflectionData.journal.feeling ?? "",
              accomplished: reflectionData.journal.accomplished ?? "",
              distractedBy: reflectionData.journal.distractedBy ?? "",
              improveTomorrow: reflectionData.journal.improveTomorrow ?? "",
            }} />
          </PlanItem>
        </PlanSection>
      )}
      {otherActions.length > 0 && (
        <PlanSection label="Also saving">
          {otherActions.map((a) => {
            const i = actions.indexOf(a);
            return (
              <PlanItem key={a.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)}>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{a.label}</p>
              </PlanItem>
            );
          })}
        </PlanSection>
      )}
    </div>
  );
}

// ── QUESTION view ─────────────────────────────────────────────────────────────

function QuestionView({ answer }: { answer: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{answer}</p>
    </div>
  );
}

function isVisibleAction(action: PlannedAction): boolean {
  return action.type !== "NO_ACTION" &&
    action.type !== "CREATE_EXPRESSION_REWRITE" &&
    action.type !== "CREATE_EXPRESSION_TREND";
}

// ── PLAN view ─────────────────────────────────────────────────────────────────

function DailyPlanView({
  plan, actions, actionInclusion, onToggleAction,
}: {
  plan: import("@/lib/intelligence/types").PlanSummary;
  actions: PlannedAction[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{plan.suggestion}</p>
        {plan.topTasks.length > 0 && (
          <div className="mt-3 space-y-1.5">
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
          <div className="mt-3 flex flex-wrap gap-1">
            {plan.habitsDue.map((h) => (
              <span key={h.id} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {h.name}
              </span>
            ))}
          </div>
        )}
        {plan.overdueCount > 0 && (
          <p className="mt-3 text-xs text-red-500">{plan.overdueCount} task{plan.overdueCount !== 1 ? "s" : ""} overdue</p>
        )}
      </div>
      {actions.some(isVisibleAction) && (
        <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          <PlanSection label="Apply">
            {actions.map((a, i) => isVisibleAction(a) && (
              <PlanItem key={a.id} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)}>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{a.label}</p>
              </PlanItem>
            ))}
          </PlanSection>
        </div>
      )}
    </div>
  );
}

// ── MEMORY plan view ──────────────────────────────────────────────────────────

function MemoryPlanView({
  candidates, actionInclusion, onToggleAction, onMemorySaveEdit,
}: {
  candidates: MemoryCandidateOutput[];
  actionInclusion: ActionInclusion;
  onToggleAction: (i: number) => void;
  onMemorySaveEdit: (i: number, title: string, content: string) => void;
}) {
  return (
    <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
      <PlanSection label="Save to memory">
        {candidates.map((mem, i) => (
          <PlanItem key={i} included={!!actionInclusion[i]} onToggle={() => onToggleAction(i)}>
            <MemoryCandidateCard candidate={mem} index={i} onSaveEdit={onMemorySaveEdit} />
          </PlanItem>
        ))}
      </PlanSection>
    </div>
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
    result.eventPlaceholdersCreated > 0 && `${result.eventPlaceholdersCreated} event placeholder${result.eventPlaceholdersCreated !== 1 ? "s" : ""} created`,
    result.followUpsCreated > 0 && `${result.followUpsCreated} follow-up${result.followUpsCreated !== 1 ? "s" : ""} created`,
    result.activityLogsCreated > 0 && `${result.activityLogsCreated} activity log${result.activityLogsCreated !== 1 ? "s" : ""} created`,
    result.thoughtsSaved > 0 && `${result.thoughtsSaved} thought${result.thoughtsSaved !== 1 ? "s" : ""} saved`,
    result.learningItemsCreated > 0 && `${result.learningItemsCreated} learning item${result.learningItemsCreated !== 1 ? "s" : ""} created`,
    result.questionsCreated > 0 && `${result.questionsCreated} question${result.questionsCreated !== 1 ? "s" : ""} queued`,
    result.questionsAnswered > 0 && `${result.questionsAnswered} question${result.questionsAnswered !== 1 ? "s" : ""} answered`,
    result.journalSaved && "Daily log updated",
    result.habitsUpdated > 0 && `${result.habitsUpdated} habit${result.habitsUpdated !== 1 ? "s" : ""} recorded`,
    result.projectsCreated > 0 && `${result.projectsCreated} project${result.projectsCreated !== 1 ? "s" : ""} created`,
    result.memoriesSaved > 0 && `${result.memoriesSaved} memor${result.memoriesSaved !== 1 ? "ies" : "y"} saved`,
    result.commandsExecuted > 0 && `${result.commandsExecuted} action${result.commandsExecuted !== 1 ? "s" : ""} executed`,
    result.peopleUpdated > 0 && `${result.peopleUpdated} person record${result.peopleUpdated !== 1 ? "s" : ""} updated`,
    result.insightsSaved > 0 && `${result.insightsSaved} insight${result.insightsSaved !== 1 ? "s" : ""} saved`,
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

// ── Shared card components ────────────────────────────────────────────────────

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

function JournalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
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
