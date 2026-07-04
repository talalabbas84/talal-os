"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckSquare, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateTaskStatus } from "@/features/tasks/actions/task.actions";
import { cn } from "@/utils/cn";
import type { TaskWithProject } from "@/types";

const priorityColor: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-neutral-300",
};

export function DashboardTaskList({ tasks }: { tasks: TaskWithProject[] }) {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">
          Today&apos;s Tasks
        </CardTitle>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
        >
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            Nothing due today
          </p>
        ) : (
          tasks.map((task) => {
            const isDone = optimistic[task.id] ?? task.status === "DONE";
            return (
              <div
                key={task.id}
                className="flex items-start gap-3 rounded-md p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <button
                  onClick={() => toggle(task.id, task.status)}
                  className="mt-0.5 shrink-0"
                >
                  <CheckSquare
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isDone
                        ? "text-emerald-500"
                        : "text-neutral-300 hover:text-neutral-500",
                    )}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      isDone && "text-neutral-400 line-through",
                    )}
                  >
                    {task.title}
                  </p>
                  {task.project && (
                    <p className="text-xs text-neutral-400">
                      {task.project.name}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    priorityColor[task.priority],
                  )}
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
