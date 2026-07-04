"use client";

import { useState, useTransition } from "react";
import { Circle, CheckCircle2, Pencil, Trash2, EyeOff } from "lucide-react";
import {
  deleteHabit,
  toggleHabitActive,
  toggleHabitCompletion,
} from "@/features/habits/actions/habit.actions";
import { HabitDialog } from "./habit-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { HabitWithCompletions } from "@/types";

function HabitRow({ habit }: { habit: HabitWithCompletions }) {
  const today = new Date().toISOString().split("T")[0];
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [, startTransition] = useTransition();

  if (deleted) return null;

  const realDone = habit.completions.some((c) =>
    c.date.toString().startsWith(today),
  );
  const isDone = optimisticDone ?? realDone;

  function toggle() {
    const next = !isDone;
    setOptimisticDone(next);
    startTransition(async () => {
      await toggleHabitCompletion(habit.id, today);
    });
  }

  function handleDelete() {
    if (!confirm("Delete this habit and all its history?")) return;
    setDeleted(true);
    startTransition(async () => {
      await deleteHabit(habit.id);
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      await toggleHabitActive(habit.id, !habit.isActive);
    });
  }

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border bg-white p-4 dark:bg-neutral-950",
        habit.isActive
          ? "border-neutral-200 dark:border-neutral-800"
          : "border-neutral-100 opacity-60 dark:border-neutral-900",
      )}
    >
      <button onClick={toggle} className="mt-0.5 shrink-0" disabled={!habit.isActive}>
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Circle className="h-4 w-4 text-neutral-300 hover:text-neutral-500" />
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("text-sm font-medium", isDone && "text-neutral-400 line-through")}>
          {habit.name}
        </p>
        {habit.description && (
          <p className="text-sm text-neutral-500">{habit.description}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">
            {habit.frequency === "DAILY" ? "Daily" : "Weekly"}
          </span>
          <span className="text-xs text-neutral-400">
            {habit.completions.length} completions
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          title={habit.isActive ? "Deactivate" : "Activate"}
          onClick={handleToggleActive}
        >
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
        <HabitDialog
          habit={habit}
          trigger={
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-400 hover:text-red-600"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function HabitListView({ habits }: { habits: HabitWithCompletions[] }) {
  const active = habits.filter((h) => h.isActive);
  const inactive = habits.filter((h) => !h.isActive);

  return (
    <div className="space-y-6">
      {habits.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          No habits yet. Start small.
        </p>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((h) => (
                <HabitRow key={h.id} habit={h} />
              ))}
            </div>
          )}
          {inactive.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
                Inactive
              </p>
              {inactive.map((h) => (
                <HabitRow key={h.id} habit={h} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
