"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Lightbulb,
  ListTodo,
  BookOpen,
  Repeat2,
  FolderPlus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { processCapture, saveCapture, type SaveResult } from "../actions/capture.actions";
import type { CaptureOutput } from "@/lib/ai/types";
import { cn } from "@/utils/cn";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "text-neutral-400",
  MEDIUM: "text-blue-500",
  HIGH: "text-orange-500",
  URGENT: "text-red-500",
};

interface CaptureViewProps {
  userName: string;
}

type Step = "input" | "preview" | "saved";

export function CaptureView({ userName }: CaptureViewProps) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [output, setOutput] = useState<CaptureOutput | null>(null);
  const [confirmedProjects, setConfirmedProjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [isProcessing, startProcessing] = useTransition();
  const [isSaving, startSaving] = useTransition();

  const firstName = userName.split(" ")[0] ?? userName;

  function handleOrganize() {
    setError(null);
    startProcessing(async () => {
      const result = await processCapture(text);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOutput(result.data);
      setConfirmedProjects(new Set()); // projects are opt-in
      setStep("preview");
    });
  }

  function handleEdit() {
    setStep("input");
    setOutput(null);
    setError(null);
  }

  function handleSave() {
    if (!output) return;
    setError(null);
    const projectNames = [...confirmedProjects];
    startSaving(async () => {
      const result = await saveCapture(output, projectNames);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaveResult(result.data);
      setStep("saved");
    });
  }

  function handleReset() {
    setStep("input");
    setText("");
    setOutput(null);
    setError(null);
    setSaveResult(null);
    setConfirmedProjects(new Set());
  }

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
          isProcessing={isProcessing}
          error={error}
        />
      )}

      {step === "preview" && output && (
        <PreviewView
          output={output}
          confirmedProjects={confirmedProjects}
          onToggleProject={(name) => {
            setConfirmedProjects((prev) => {
              const next = new Set(prev);
              if (next.has(name)) next.delete(name);
              else next.add(name);
              return next;
            });
          }}
          onEdit={handleEdit}
          onSave={handleSave}
          isSaving={isSaving}
          error={error}
        />
      )}
    </div>
  );
}

// ── Input step ──────────────────────────────────────────────────────────────

function InputView({
  firstName,
  text,
  onTextChange,
  onOrganize,
  isProcessing,
  error,
}: {
  firstName: string;
  text: string;
  onTextChange: (v: string) => void;
  onOrganize: () => void;
  isProcessing: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          What&apos;s on your mind, {firstName}?
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Type anything — tasks, ideas, how you&apos;re feeling. The app will organize it for you.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={
          "e.g. I feel sick today so I skipped dance. Tomorrow I need to go gym and buy groceries. Also I have an idea for an AI immigration website."
        }
        rows={8}
        className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-relaxed text-neutral-900 placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 focus:ring-0 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
        disabled={isProcessing}
      />

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <button
        onClick={onOrganize}
        disabled={isProcessing || text.trim().length < 3}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
          "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        {isProcessing ? (
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

// ── Preview step ─────────────────────────────────────────────────────────────

function PreviewView({
  output,
  confirmedProjects,
  onToggleProject,
  onEdit,
  onSave,
  isSaving,
  error,
}: {
  output: CaptureOutput;
  confirmedProjects: Set<string>;
  onToggleProject: (name: string) => void;
  onEdit: () => void;
  onSave: () => void;
  isSaving: boolean;
  error: string | null;
}) {
  const hasContent =
    output.tasks.length > 0 ||
    output.ideas.length > 0 ||
    output.habits.length > 0 ||
    output.journal.feeling ||
    output.journal.improveTomorrow;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Here&apos;s what I found
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{output.summary}</p>
      </div>

      {/* Mood / Health badges */}
      {(output.mood || output.healthStatus) && (
        <div className="flex flex-wrap gap-2">
          {output.mood && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Mood: {output.mood}
            </span>
          )}
          {output.healthStatus && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Health: {output.healthStatus}
            </span>
          )}
        </div>
      )}

      {!hasContent && (
        <p className="rounded-xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400 dark:border-neutral-700">
          Nothing specific was extracted. Try adding more detail to your note.
        </p>
      )}

      {/* Tasks */}
      {output.tasks.length > 0 && (
        <Section icon={ListTodo} title="Tasks" count={output.tasks.length} note="Will be added to your task list">
          <ul className="space-y-2">
            {output.tasks.map((task, i) => (
              <li key={i} className="flex items-start gap-3">
                <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{task.title}</p>
                  <p className="text-xs text-neutral-400">
                    <span className={PRIORITY_COLORS[task.priority]}>{task.priority}</span>
                    {task.dueDate && ` · due ${formatDate(task.dueDate)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Ideas */}
      {output.ideas.length > 0 && (
        <Section icon={Lightbulb} title="Ideas" count={output.ideas.length} note="Will be saved to Inbox">
          <ul className="space-y-2">
            {output.ideas.map((idea, i) => (
              <li key={i} className="flex items-start gap-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{idea.title}</p>
                  <p className="text-xs text-neutral-400">{idea.category}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Journal */}
      {(output.journal.feeling || output.journal.improveTomorrow || output.journal.accomplished) && (
        <Section icon={BookOpen} title="Daily Log" note="Will update today's log">
          <dl className="space-y-1 text-sm">
            {output.journal.feeling && (
              <Row label="Feeling" value={output.journal.feeling} />
            )}
            {output.journal.accomplished && (
              <Row label="Accomplished" value={output.journal.accomplished} />
            )}
            {output.journal.improveTomorrow && (
              <Row label="Tomorrow" value={output.journal.improveTomorrow} />
            )}
          </dl>
        </Section>
      )}

      {/* Habits */}
      {output.habits.length > 0 && (
        <Section icon={Repeat2} title="Habits" note="Completions matched to existing habits">
          <ul className="space-y-2">
            {output.habits.map((habit, i) => (
              <li key={i} className="flex items-center gap-3">
                {habit.completed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-neutral-300" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{habit.name}</p>
                  {habit.note && <p className="text-xs text-neutral-400">{habit.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Projects (opt-in) */}
      {output.projects.length > 0 && (
        <Section
          icon={FolderPlus}
          title="Suggested Projects"
          note="Check the ones you want to create"
        >
          <ul className="space-y-2">
            {output.projects.map((project, i) => {
              const checked = confirmedProjects.has(project.name);
              return (
                <li key={i} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={`project-${i}`}
                    checked={checked}
                    onChange={() => onToggleProject(project.name)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 dark:border-neutral-600"
                  />
                  <label
                    htmlFor={`project-${i}`}
                    className="cursor-pointer text-sm font-medium text-neutral-900 dark:text-neutral-50"
                  >
                    {project.name}
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onSave}
          disabled={isSaving || !hasContent}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Everything"
          )}
        </button>
        <button
          onClick={onEdit}
          disabled={isSaving}
          className="rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Saved step ───────────────────────────────────────────────────────────────

function SavedView({ result, onReset }: { result: SaveResult; onReset: () => void }) {
  const lines: string[] = [];
  if (result.tasksCreated > 0) lines.push(`${result.tasksCreated} task${result.tasksCreated !== 1 ? "s" : ""} added`);
  if (result.ideasCreated > 0) lines.push(`${result.ideasCreated} idea${result.ideasCreated !== 1 ? "s" : ""} saved to Inbox`);
  if (result.journalSaved) lines.push("Daily log updated");
  if (result.habitsUpdated > 0) lines.push(`${result.habitsUpdated} habit completion${result.habitsUpdated !== 1 ? "s" : ""} recorded`);
  if (result.projectsCreated > 0) lines.push(`${result.projectsCreated} project${result.projectsCreated !== 1 ? "s" : ""} created`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {title}
            {count !== undefined && (
              <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">
                {count}
              </span>
            )}
          </span>
        </div>
        {note && <span className="text-xs text-neutral-400">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-neutral-400">{label}</dt>
      <dd className="text-neutral-700 dark:text-neutral-300">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
