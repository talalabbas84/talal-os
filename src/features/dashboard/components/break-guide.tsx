import Link from "next/link";

const TIPS = [
  "Step away from the screen for 5 minutes.",
  "Drink a full glass of water.",
  "Stretch your shoulders and neck.",
  "Take 5 slow breaths.",
  "Walk to the window and look at something distant.",
];

export function BreakGuide() {
  return (
    <section>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-6 dark:border-sky-900/40 dark:bg-sky-950/20">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
          Break Time
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          Good session. Rest before the next one.
        </p>
        <p className="mt-1 text-sm leading-6 text-neutral-500">
          Step away for a few minutes — it sharpens the next block.
        </p>
        <ul className="mt-4 space-y-2">
          {TIPS.slice(0, 3).map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              {tip}
            </li>
          ))}
        </ul>
        <Link
          href="/capture?text=Back+to+work+on..."
          className="mt-5 inline-block text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-200"
        >
          Ready to continue
        </Link>
      </div>
    </section>
  );
}
