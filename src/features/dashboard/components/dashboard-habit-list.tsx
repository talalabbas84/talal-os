"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Circle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleHabitCompletion } from "@/features/habits/actions/habit.actions";
import { cn } from "@/utils/cn";
import type { HabitWithCompletions } from "@/types";

export function DashboardHabitList({
  habits,
}: {
  habits: HabitWithCompletions[];
}) {
  const today = new Date().toISOString().split("T")[0];
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function toggle(habitId: string, wasCompleted: boolean) {
    setOptimistic((prev) => ({ ...prev, [habitId]: !wasCompleted }));
    startTransition(async () => {
      await toggleHabitCompletion(habitId, today);
    });
  }

  const completed = habits.filter((h) => {
    const real = h.completions.length > 0;
    return optimistic[h.id] !== undefined ? optimistic[h.id] : real;
  }).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">
          Today&apos;s Habits
          {habits.length > 0 && (
            <span className="ml-2 font-normal text-neutral-400">
              {completed}/{habits.length}
            </span>
          )}
        </CardTitle>
        <Link
          href="/habits"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
        >
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {habits.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            No habits yet
          </p>
        ) : (
          habits.map((habit) => {
            const realDone = habit.completions.length > 0;
            const isDone =
              optimistic[habit.id] !== undefined
                ? optimistic[habit.id]
                : realDone;

            return (
              <button
                key={habit.id}
                onClick={() => toggle(habit.id, isDone)}
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-neutral-300" />
                )}
                <span
                  className={cn(
                    "text-sm",
                    isDone && "text-neutral-400 line-through",
                  )}
                >
                  {habit.name}
                </span>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
