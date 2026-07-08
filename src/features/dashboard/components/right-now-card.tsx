"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus } from "@/features/tasks/actions/task.actions";
import { cn } from "@/utils/cn";

export interface RightNowItem {
  type: "task" | "habit" | "learning";
  id: string;
  verb: string;
  title: string;
  project: string | null;
  reason: string | null;
  href: string;
  estimatedMinutes?: number | null;
}

export function RightNowCard({ item }: { item: RightNowItem }) {
  const router = useRouter();
  const [isDone, startDone] = useTransition();

  function handleStart() {
    router.push(item.href);
  }

  function handleDone() {
    if (item.type !== "task") return;
    startDone(async () => {
      await updateTaskStatus(item.id, "DONE");
      router.refresh();
    });
  }

  function handleReschedule() {
    const text = `Reschedule: ${item.title}`;
    router.push(`/capture?text=${encodeURIComponent(text)}`);
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      {item.project && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {item.project}
        </p>
      )}

      <p className="text-xl font-semibold leading-snug text-neutral-900 dark:text-neutral-50">
        {item.verb} {item.title}
      </p>

      {item.estimatedMinutes && (
        <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">
          Estimated {item.estimatedMinutes} min
        </p>
      )}

      {item.reason && (
        <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {item.reason}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={handleStart}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
          )}
        >
          {item.type === "learning" ? "Review" : item.type === "habit" ? "Log" : "Start"}
        </button>

        {item.type === "task" && (
          <button
            onClick={handleDone}
            disabled={isDone}
            className={cn(
              "rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40",
              "dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900",
            )}
          >
            Mark Done
          </button>
        )}

        <button
          onClick={handleReschedule}
          className="rounded-xl px-3 py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Reschedule
        </button>
      </div>
    </div>
  );
}
