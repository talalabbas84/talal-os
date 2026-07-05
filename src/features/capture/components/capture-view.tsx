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
} from "lucide-react";
import { organizeCapture, saveCapture, type SaveResult } from "../actions/capture.actions";
import type {
  CaptureResult,
  TaskOutput,
  IdeaOutput,
  HabitOutput,
  ProjectOutput,
  ReminderOutput,
  MemoryCandidateOutput,
  CommandOutput,
} from "@/lib/ai/types";
import type { SaveCaptureInput } from "../lib/schema";
import { TYPE_LABELS, IMPORTANCE_STYLES } from "@/features/memory/components/memory-view";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "input" | "preview" | "saved";

interface Inclusion {
  tasks: boolean[];
  ideas: boolean[];
  habits: boolean[];
  projects: boolean[];
  reminders: boolean[];
  memories: boolean[];
  commands: boolean[];
  journal: boolean;
}

// edit state committed to parent when user clicks "Save" inside a candidate card
interface MemoryEdit {
  title: string;
  content: string;
}

// ── Root component ────────────────────────────────────────────────────────────

export function CaptureView({ userName }: { userName: string }) {
  const firstName = userName.split(" ")[0] ?? userName;

  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [inclusion, setInclusion] = useState<Inclusion | null>(null);
  const [memoryEdits, setMemoryEdits] = useState<Record<number, MemoryEdit>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [isOrganizing, startOrganizing] = useTransition();
  const [isSaving, startSaving] = useTransition();

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleOrganize() {
    setError(null);
    startOrganizing(async () => {
      const res = await organizeCapture(text);
      if (!res.success) {
        setError(res.error);
        return;
      }
      const d = res.data.data;
      setMemoryEdits({});
      // High/medium → included by default. Low → excluded. Projects always opt-in.
      // Memory: PERMANENT/HIGH → included, MEDIUM/LOW → excluded.
      setInclusion({
        tasks: d.tasks.map((i) => i.confidence !== "low"),
        ideas: d.ideas.map((i) => i.confidence !== "low"),
        habits: d.habits.map((i) => i.confidence !== "low"),
        projects: d.projects.map(() => false),
        reminders: d.reminders.map((i) => i.confidence !== "low"),
        memories: d.memoryCandidates.map(
          (m) => m.importance === "PERMANENT" || m.importance === "HIGH",
        ),
        commands: d.commands.map((c) => c.confidence !== "low"),
        journal: !!(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow),
      });
      setResult(res.data);
      setStep("preview");
    });
  }

  function handleRetry() {
    setError(null);
    setStep("input");
    setResult(null);
    setInclusion(null);
    setMemoryEdits({});
  }

  function toggle(key: keyof Omit<Inclusion, "journal">, index: number) {
    setInclusion((prev) => {
      if (!prev) return prev;
      const arr = [...prev[key]];
      arr[index] = !arr[index];
      return { ...prev, [key]: arr };
    });
  }

  function handleMemorySaveEdit(i: number, title: string, content: string) {
    setMemoryEdits((prev) => ({ ...prev, [i]: { title, content } }));
  }

  function handleSave() {
    if (!result || !inclusion) return;
    setError(null);

    const d = result.data;
    const input: SaveCaptureInput = {
      tasks: d.tasks.filter((_, i) => inclusion.tasks[i]),
      ideas: d.ideas.filter((_, i) => inclusion.ideas[i]),
      habits: d.habits.filter((_, i) => inclusion.habits[i]),
      projects: d.projects.filter((_, i) => inclusion.projects[i]),
      reminders: d.reminders.filter((_, i) => inclusion.reminders[i]),
      journal: d.journal,
      saveJournal: inclusion.journal,
      memories: d.memoryCandidates
        .map((m, i) => ({ m, i }))
        .filter(({ i }) => !!inclusion.memories[i])
        .map(({ m, i }) => {
          const edit = memoryEdits[i];
          return {
            title: edit?.title ?? m.title,
            content: edit?.content ?? m.content,
            type: m.type,
            importance: m.importance,
          };
        }),
      commands: d.commands
        .filter((_, i) => !!inclusion.commands[i])
        .map(({ type, target, details }) => ({ type, target, details })),
    };

    startSaving(async () => {
      const res = await saveCapture(input);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSaveResult(res.data);
      setStep("saved");
    });
  }

  function handleReset() {
    setStep("input");
    setText("");
    setResult(null);
    setInclusion(null);
    setError(null);
    setSaveResult(null);
    setMemoryEdits({});
  }

  // commands toggled via the same generic toggle() — key is "commands"

  // ── Render ──────────────────────────────────────────────────────────────────

  if (step === "saved" && saveResult) {
    return <SavedView result={saveResult} onReset={handleReset} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {step === "input" && (
        <InputView
          firstName={firstName}
          text={text}
          onTextChange={setText}
          onOrganize={handleOrganize}
          isOrganizing={isOrganizing}
          error={error}
          onRetry={() => setError(null)}
        />
      )}

      {step === "preview" && result && inclusion && (
        <PreviewView
          result={result}
          inclusion={inclusion}
          memoryEdits={memoryEdits}
          onToggle={toggle}
          onToggleJournal={() =>
            setInclusion((p) => p && { ...p, journal: !p.journal })
          }
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
  firstName,
  text,
  onTextChange,
  onOrganize,
  isOrganizing,
  error,
  onRetry,
}: {
  firstName: string;
  text: string;
  onTextChange: (v: string) => void;
  onOrganize: () => void;
  isOrganizing: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          What&apos;s on your mind, {firstName}?
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Type anything — tasks, ideas, feelings, plans. Just talk.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="e.g. I feel sick today so I skipped dance. Tomorrow I need to go gym and buy groceries. Also I have an idea for an AI immigration website."
        rows={8}
        disabled={isOrganizing}
        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
      />

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={onRetry}
              className="mt-1 text-xs font-medium text-red-600 underline dark:text-red-400"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onOrganize}
        disabled={isOrganizing || text.trim().length < 3}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
          "bg-neutral-900 text-white hover:bg-neutral-700",
          "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        {isOrganizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Organizing…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Organize
          </>
        )}
      </button>
    </div>
  );
}

// ── Preview step ──────────────────────────────────────────────────────────────

function PreviewView({
  result,
  inclusion,
  memoryEdits,
  onToggle,
  onToggleJournal,
  onMemorySaveEdit,
  onEdit,
  onSave,
  isSaving,
  error,
}: {
  result: CaptureResult;
  inclusion: Inclusion;
  memoryEdits: Record<number, MemoryEdit>;
  onToggle: (key: keyof Omit<Inclusion, "journal">, index: number) => void;
  onToggleJournal: () => void;
  onMemorySaveEdit: (i: number, title: string, content: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const d = result.data;
  const hasAnything =
    d.tasks.length > 0 ||
    d.ideas.length > 0 ||
    d.habits.length > 0 ||
    d.reminders.length > 0 ||
    d.memoryCandidates.length > 0 ||
    d.journal.feeling ||
    d.journal.improveTomorrow;

  const selectedCount =
    inclusion.tasks.filter(Boolean).length +
    inclusion.ideas.filter(Boolean).length +
    inclusion.habits.filter(Boolean).length +
    inclusion.projects.filter(Boolean).length +
    inclusion.reminders.filter(Boolean).length +
    inclusion.memories.filter(Boolean).length +
    inclusion.commands.filter(Boolean).length +
    (inclusion.journal ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* AI Reflection */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-400" />
          <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            AI
          </span>
        </div>
        <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {result.reflection}
        </p>
        {(d.mood || d.healthStatus) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {d.mood && <Chip color="blue">{d.mood}</Chip>}
            {d.healthStatus && <Chip color="amber">{d.healthStatus}</Chip>}
          </div>
        )}
      </div>

      {/* Nothing extracted */}
      {!hasAnything && (
        <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400 dark:border-neutral-700">
          Nothing specific was extracted. Try adding more detail.
        </p>
      )}

      {/* Tasks */}
      {d.tasks.length > 0 && (
        <Section icon={ListTodo} title="Tasks" count={d.tasks.length}>
          {d.tasks.map((task, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.tasks[i]}
              onToggle={() => onToggle("tasks", i)}
              confidence={task.confidence}
            >
              <TaskCard task={task} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Ideas */}
      {d.ideas.length > 0 && (
        <Section icon={Lightbulb} title="Ideas" count={d.ideas.length} note="→ Inbox">
          {d.ideas.map((idea, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.ideas[i]}
              onToggle={() => onToggle("ideas", i)}
              confidence={idea.confidence}
            >
              <IdeaCard idea={idea} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Journal */}
      {(d.journal.feeling || d.journal.accomplished || d.journal.improveTomorrow || d.journal.distractedBy) && (
        <Section icon={BookOpen} title="Daily Log" note="→ Today's entry">
          <ItemRow
            included={inclusion.journal}
            onToggle={onToggleJournal}
            confidence="high"
          >
            <JournalCard journal={d.journal} />
          </ItemRow>
        </Section>
      )}

      {/* Habits */}
      {d.habits.length > 0 && (
        <Section icon={Repeat2} title="Habits" note="Matched to existing habits">
          {d.habits.map((habit, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.habits[i]}
              onToggle={() => onToggle("habits", i)}
              confidence={habit.confidence}
            >
              <HabitCard habit={habit} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Projects — always opt-in */}
      {d.projects.length > 0 && (
        <Section icon={FolderPlus} title="Projects" note="Opt-in — unchecked by default">
          {d.projects.map((project, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.projects[i]}
              onToggle={() => onToggle("projects", i)}
              confidence={project.confidence}
              alwaysShowToggle
            >
              <ProjectCard project={project} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Reminders */}
      {d.reminders.length > 0 && (
        <Section icon={Bell} title="Reminders" note="→ Inbox">
          {d.reminders.map((reminder, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.reminders[i]}
              onToggle={() => onToggle("reminders", i)}
              confidence={reminder.confidence}
            >
              <ReminderCard reminder={reminder} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Memory candidates — always require explicit review */}
      {d.memoryCandidates.length > 0 && (
        <Section
          icon={Brain}
          title="Possible Memories"
          count={d.memoryCandidates.length}
          note="→ Memory Vault"
        >
          {d.memoryCandidates.map((candidate, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.memories[i]}
              onToggle={() => onToggle("memories", i)}
              confidence="high"
              alwaysShowToggle
            >
              <MemoryCandidateCard
                candidate={candidate}
                index={i}
                onSaveEdit={onMemorySaveEdit}
              />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Commands */}
      {d.commands.length > 0 && (
        <Section
          icon={Zap}
          title="Actions"
          count={d.commands.length}
          note="Executes against existing data"
        >
          {d.commands.map((cmd, i) => (
            <ItemRow
              key={i}
              included={!!inclusion.commands[i]}
              onToggle={() => onToggle("commands", i)}
              confidence={cmd.confidence}
              alwaysShowToggle
            >
              <CommandCard cmd={cmd} />
            </ItemRow>
          ))}
        </Section>
      )}

      {/* Error */}
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
          disabled={isSaving || selectedCount === 0}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Approve &amp; Save
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

// ── Saved step ────────────────────────────────────────────────────────────────

function SavedView({ result, onReset }: { result: SaveResult; onReset: () => void }) {
  const lines: string[] = [
    result.tasksCreated > 0 && `${result.tasksCreated} task${result.tasksCreated !== 1 ? "s" : ""} added`,
    result.ideasCreated > 0 && `${result.ideasCreated} idea${result.ideasCreated !== 1 ? "s" : ""} saved to Inbox`,
    result.remindersCreated > 0 && `${result.remindersCreated} reminder${result.remindersCreated !== 1 ? "s" : ""} saved to Inbox`,
    result.journalSaved && "Daily log updated",
    result.habitsUpdated > 0 && `${result.habitsUpdated} habit completion${result.habitsUpdated !== 1 ? "s" : ""} recorded`,
    result.projectsCreated > 0 && `${result.projectsCreated} project${result.projectsCreated !== 1 ? "s" : ""} created`,
    result.memoriesSaved > 0 && `${result.memoriesSaved} memor${result.memoriesSaved !== 1 ? "ies" : "y"} saved to vault`,
    result.commandsExecuted > 0 && `${result.commandsExecuted} action${result.commandsExecuted !== 1 ? "s" : ""} executed`,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
          <p className="font-medium text-green-800 dark:text-green-200">All saved.</p>
        </div>
        {lines.length > 0 && (
          <ul className="mt-3 space-y-1 pl-8">
            {lines.map((line, i) => (
              <li key={i} className="text-sm text-green-700 dark:text-green-300">
                {line}
              </li>
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

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  note,
  children,
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
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
          {count !== undefined && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
              {count}
            </span>
          )}
        </div>
        {note && <span className="text-xs text-neutral-400">{note}</span>}
      </div>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">{children}</div>
    </div>
  );
}

function ItemRow({
  included,
  onToggle,
  confidence,
  alwaysShowToggle = false,
  children,
}: {
  included: boolean;
  onToggle: () => void;
  confidence: string;
  alwaysShowToggle?: boolean;
  children: React.ReactNode;
}) {
  const isLow = confidence === "low";
  const showToggle = alwaysShowToggle || isLow;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-opacity",
        !included && "opacity-40",
      )}
    >
      {showToggle ? (
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
              <path
                d="M3 8l3.5 3.5L13 4.5"
                stroke={included ? "white" : "transparent"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      ) : (
        <button
          onClick={onToggle}
          className="mt-0.5 shrink-0 text-neutral-300 transition-colors hover:text-neutral-400"
          aria-label={included ? "Exclude" : "Include"}
        >
          {included ? (
            <CheckCircle2 className="h-4 w-4 text-neutral-400" />
          ) : (
            <div className="h-4 w-4 rounded-full border-2 border-neutral-300" />
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">{children}</div>

      {confidence === "low" && (
        <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-950 dark:text-amber-400">
          low
        </span>
      )}
      {confidence === "medium" && (
        <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">
          ~
        </span>
      )}
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
  const hasTimeContext = task.dueDate || task.dueTime || task.timeContext;
  const timeLabel = [
    task.dueDate && formatDate(task.dueDate),
    task.dueTime,
    !task.dueDate && task.timeContext && task.timeContext.replace(/_/g, " "),
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{task.title}</p>
        {task.needsReminder && (
          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            🔔 reminder
          </span>
        )}
      </div>

      {hasTimeContext && (
        <p className="text-xs text-neutral-400">{timeLabel}</p>
      )}

      <div className="flex flex-wrap gap-1">
        <MetaBadge label="U" value={task.urgency} colors={URGENCY_COLORS} title="Urgency" />
        <MetaBadge label="I" value={task.importance} colors={IMPORTANCE_COLORS} title="Importance" />
        <MetaBadge label="E" value={task.energyRequired} colors={ENERGY_COLORS} title="Energy" />
        {task.projectName && (
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
            {task.projectName}
          </span>
        )}
      </div>
    </div>
  );
}

function MetaBadge({
  label,
  value,
  colors,
  title,
}: {
  label: string;
  value: string;
  colors: Record<string, string>;
  title: string;
}) {
  if (value === "MEDIUM") return null;
  return (
    <span
      title={`${title}: ${value}`}
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        colors[value] ?? "bg-neutral-100 text-neutral-500",
      )}
    >
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

function JournalCard({
  journal,
}: {
  journal: { feeling: string; accomplished: string; improveTomorrow: string; distractedBy: string };
}) {
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
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            habit.completed ? "bg-green-500" : "bg-neutral-300",
          )}
        />
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
      {project.description && (
        <p className="mt-0.5 text-xs text-neutral-400">{project.description}</p>
      )}
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
  candidate,
  index,
  onSaveEdit,
}: {
  candidate: MemoryCandidateOutput;
  index: number;
  onSaveEdit: (i: number, title: string, content: string) => void;
}) {
  const [committed, setCommitted] = useState({
    title: candidate.title,
    content: candidate.content,
  });
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(candidate.title);
  const [editContent, setEditContent] = useState(candidate.content);

  function handleSave() {
    const saved = { title: editTitle, content: editContent };
    setCommitted(saved);
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
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              IMPORTANCE_STYLES[candidate.importance as keyof typeof IMPORTANCE_STYLES] ??
                "bg-neutral-100 text-neutral-500",
            )}
          >
            {candidate.importance}
          </span>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
            {TYPE_LABELS[candidate.type as keyof typeof TYPE_LABELS] ?? candidate.type}
          </span>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 text-neutral-300 transition-colors hover:text-neutral-500"
            aria-label="Edit memory candidate"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-50"
          />
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-400 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-neutral-50 dark:text-neutral-900"
            >
              <CheckCircle2 className="h-3 w-3" /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 dark:border-neutral-600"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {committed.title}
          </p>
          <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            {committed.content}
          </p>
          <p className="text-[10px] italic text-neutral-400">{candidate.reason}</p>
        </>
      )}
    </div>
  );
}

function CommandCard({ cmd }: { cmd: CommandOutput }) {
  const label = formatCommandLabel(cmd);
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{label}</p>
      {cmd.details && (
        <p className="text-xs text-neutral-400">{cmd.details}</p>
      )}
    </div>
  );
}

function formatCommandLabel(cmd: CommandOutput): string {
  switch (cmd.type) {
    case "COMPLETE_TASK":
      return `Mark "${cmd.target}" as done`;
    case "COMPLETE_HABIT":
      return `Log habit: ${cmd.target}`;
    case "RESCHEDULE_TASK":
      return `Reschedule "${cmd.target}"${cmd.details ? ` → ${cmd.details}` : ""}`;
    case "ADD_REMINDER":
      return `Add reminder: ${cmd.target}`;
    default:
      return cmd.target;
  }
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
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        color === "blue" &&
          "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        color === "amber" &&
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
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
