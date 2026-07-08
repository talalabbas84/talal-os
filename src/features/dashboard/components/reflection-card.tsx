import Link from "next/link";
import type { DailyPlan } from "@/lib/intelligence/morning-planning-engine";

export function ReflectionCard({ plan }: { plan: DailyPlan }) {
  const activityCount = plan.todayActivityCount;
  const lastActivity = plan.todayActivityLogs[0];
  const accomplished = plan.recentReflection?.accomplished;

  let body: string;
  if (accomplished) {
    body = `Yesterday you ${accomplished.slice(0, 100).toLowerCase()}.`;
  } else if (lastActivity) {
    body = `You've been working on ${lastActivity.activity.toLowerCase()} today.`;
  } else if (activityCount > 0) {
    body = `You had ${activityCount} logged activities today.`;
  } else {
    body = "Today is winding down.";
  }

  return (
    <section>
      <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Reflection
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          How was your day?
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">{body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/capture?text=Today%20I..."
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Reflect
          </Link>
          <Link
            href="/capture?text=Tomorrow%20I%20want%20to..."
            className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Plan tomorrow
          </Link>
        </div>
      </div>
    </section>
  );
}
