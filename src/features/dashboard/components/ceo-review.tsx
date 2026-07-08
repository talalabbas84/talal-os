import Link from "next/link";
import type { DailyPlan } from "@/lib/intelligence/morning-planning-engine";

export function CeoReview({ plan }: { plan: DailyPlan }) {
  const mission = plan.todayMission;
  const activeTaskCount = plan.topTasks.length;
  const habitsTotal = plan.habitsDue.length;

  return (
    <section>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-950">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          CEO Review
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          Step back. How is the system running?
        </p>
        {mission && (
          <p className="mt-1 text-sm leading-6 text-neutral-500">
            Current chapter: {mission}
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href="/tasks"
            className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">Active tasks</span>
            <span className="mt-0.5 block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {activeTaskCount} prioritized
            </span>
          </Link>
          <Link
            href="/habits"
            className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <span className="block text-xs text-neutral-400 dark:text-neutral-500">Habits today</span>
            <span className="mt-0.5 block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {habitsTotal} due
            </span>
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/capture?text=Weekly+review:+this+week+I..."
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Write weekly review
          </Link>
          <Link
            href="/projects"
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Review projects
          </Link>
        </div>
      </div>
    </section>
  );
}
