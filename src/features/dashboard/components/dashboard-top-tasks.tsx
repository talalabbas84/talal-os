"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateTaskStatus } from "@/features/tasks/actions/task.actions";
import { cn } from "@/utils/cn";
import type { TaskWithProject } from "@/types";

const URGENCY_DOT: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-blue-400",
  LOW: "bg-neutral-300",
};

export function DashboardTopTasks({ tasks }: { tasks: TaskWithProject[] }) {
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  function toggle(id: string, currentStatus: string) {
    const done = currentStatus !== "DONE";
    setOptimistic((prev) => ({ ...prev, [id]: done }));
    startTransition(async () => {
      await updateTaskStatus(id, done ? "DONE" : "TODO");
    });
  }

  return (
    <Card className="border-neutral-200 dark:border-neutral-800">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-400" />
          <CardTitle className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            Today&apos;s Top 3
          </CardTitle>
        </div>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          All tasks <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>

      <CardContent>
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            Nothing urgent today.
          </p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task, rank) => {
              const isDone = optimistic[task.id] ?? task.status === "DONE";
              const urgency = (task as Record<string, unknown>).urgency as string | undefined;
              const timeContext = (task as Record<string, unknown>).timeContext as string | null | undefined;
              return (
                <li
                  key={task.id}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    {rank + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        isDone
                          ? "text-neutral-400 line-through"
                          : "text-neutral-900 dark:text-neutral-50",
                      )}
                    >
                      {task.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                      {task.dueDate && <span>{formatDate(task.dueDate)}</span>}
                      {timeContext && (
                        <span className="rounded-full bg-neutral-100 px-1.5 dark:bg-neutral-800">
                          {timeContext.replace(/_/g, " ")}
                        </span>
                      )}
                      {task.project && <span>{task.project.name}</span>}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      urgency ? (URGENCY_DOT[urgency] ?? "bg-neutral-300") : "bg-neutral-300",
                    )}
                    title={urgency ? `Urgency: ${urgency}` : undefined}
                  />

                  <button
                    onClick={() => toggle(task.id, task.status)}
                    className="mt-0.5 shrink-0"
                    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                  >
                    <CheckCircle2
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isDone
                          ? "text-emerald-500"
                          : "text-neutral-300 hover:text-neutral-500",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
