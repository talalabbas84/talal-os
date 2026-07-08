import Link from "next/link";
import type { DailyPlan } from "@/lib/intelligence/morning-planning-engine";

const RECOVERY_TIPS = [
  "Drink a full glass of water right now.",
  "Rest is work too. Protecting your energy is productive.",
  "One small thing done is a win today.",
  "Step outside for 5 minutes if you can.",
  "Close unnecessary tabs and apps.",
];

export function RecoveryGuide({ plan }: { plan: DailyPlan }) {
  const essentialTask = plan.topTasks[0];

  return (
    <section>
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 dark:border-amber-900/40 dark:bg-amber-950/20">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Recovery Mode
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          Take care of yourself first.
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          Non-essential work can wait. Your health cannot.
        </p>

        <ul className="mt-4 space-y-2">
          {RECOVERY_TIPS.slice(0, 3).map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              {tip}
            </li>
          ))}
        </ul>

        {essentialTask && (
          <div className="mt-5 border-t border-amber-100 pt-4 dark:border-amber-900/40">
            <p className="text-xs text-amber-600 dark:text-amber-500">If you do one thing:</p>
            <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {essentialTask.title}
            </p>
          </div>
        )}

        <Link
          href="/capture?text=How%20I%27m%20feeling%20today..."
          className="mt-4 inline-block text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
        >
          Log how you&apos;re feeling
        </Link>
      </div>
    </section>
  );
}
