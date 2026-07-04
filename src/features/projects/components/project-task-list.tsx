"use client";

import { useState, useTransition } from "react";
import { CheckSquare, Pencil, Trash2 } from "lucide-react";
import {
  deleteTask,
  updateTaskStatus,
} from "@/features/tasks/actions/task.actions";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { Button } from "@/components/ui/button";
import { formatDateShort } from "@/utils/date";
import { cn } from "@/utils/cn";
import type { Task, TaskStatus } from "@/types";

const priorityColors: Record<string, string> = {
  URGENT: "bg-red-500",
  HIGH: "bg-amber-500",
  MEDIUM: "bg-blue-500",
  LOW: "bg-neutral-300",
};

const statusTabs: { label: string; value: TaskStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "To do", value: "TODO" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Done", value: "DONE" },
];

function TaskRow({ task }: { task: Task }) {
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [, startTransition] = useTransition();

  if (deleted) return null;

  const isDone = optimisticDone ?? task.status === "DONE";

  function toggle() {
    const next = !isDone;
    setOptimisticDone(next);
    startTransition(async () => {
      await updateTaskStatus(task.id, next ? "DONE" : "TODO");
    });
  }

  function handleDelete() {
    setDeleted(true);
    startTransition(async () => {
      await deleteTask(task.id);
    });
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-neutral-100 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <button onClick={toggle} className="mt-0.5 shrink-0">
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
        <p className={cn("text-sm", isDone && "text-neutral-400 line-through")}>
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-neutral-400 line-clamp-1">
            {task.description}
          </p>
        )}
        {task.dueDate && (
          <p className="mt-0.5 text-xs text-neutral-400">
            Due {formatDateShort(task.dueDate)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            priorityColors[task.priority],
          )}
        />
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <TaskDialog
            task={task}
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
    </div>
  );
}

export function ProjectTaskList({
  tasks,
}: {
  tasks: Task[];
}) {
  const [filter, setFilter] = useState<TaskStatus | "ALL">("ALL");

  const filtered =
    filter === "ALL" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-neutral-400">
              {tasks.filter(
                (t) => tab.value === "ALL" || t.status === tab.value,
              ).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-400">
          No tasks yet
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
