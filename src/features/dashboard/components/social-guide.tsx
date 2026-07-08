import type { EventPlaceholder } from "@prisma/client";

const TIPS = [
  "Put the phone away. Be fully present.",
  "Ask about what they're working on right now.",
  "Listen more than you speak.",
  "Share something honest — it builds real connection.",
  "Remember one thing they tell you.",
];

export function SocialGuide({ nextEvent }: { nextEvent: EventPlaceholder | null }) {
  return (
    <section>
      <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 dark:border-rose-900/40 dark:bg-rose-950/20">
        <p className="text-xs font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Social
        </p>
        <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
          {nextEvent ? `${nextEvent.title} — enjoy every bit of it.` : "Social time. Be fully here."}
        </p>
        <ul className="mt-4 space-y-2">
          {TIPS.slice(0, 3).map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
