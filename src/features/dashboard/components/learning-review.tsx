import Link from "next/link";
import type { DailyPlan } from "@/lib/intelligence/morning-planning-engine";

export function LearningReview({ plan }: { plan: DailyPlan }) {
  const due = plan.dueLearningItems.slice(0, 3);

  return (
    <section>
      <div className="rounded-2xl border border-violet-100 bg-violet-50 p-6 dark:border-violet-900/40 dark:bg-violet-950/20">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400">
          Learning Session
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          {due.length > 0
            ? `${due.length} item${due.length > 1 ? "s" : ""} due for review.`
            : "Good time to study something."}
        </p>
        {due.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {due.map((item) => (
              <li key={item.id} className="text-sm text-neutral-600 dark:text-neutral-400">
                {item.title}
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/learn/review"
          className="mt-5 inline-block rounded-xl bg-violet-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-800 dark:bg-violet-600 dark:hover:bg-violet-500"
        >
          Start Review
        </Link>
      </div>
    </section>
  );
}
