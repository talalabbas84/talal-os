import type { ContextWindowData } from "@/lib/context-windows/context-window-engine";

export function NowFlow({ data }: { data: ContextWindowData }) {
  const { previous, current, next, bridgeRecommendation } = data;

  // Need at least previous or next + bridge to be worth showing
  if (!bridgeRecommendation && !previous && !next) return null;

  return (
    <section>
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        Now Flow
      </p>

      {/* Three-window timeline */}
      <div className="flex items-start gap-1 overflow-hidden">
        {previous && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Before
              </p>
              <p className="mt-1 text-sm leading-snug text-neutral-500 dark:text-neutral-500">
                {previous.summary}
              </p>
            </div>
            <span className="mt-4 shrink-0 px-1.5 text-neutral-300 dark:text-neutral-700">→</span>
          </>
        )}

        {current && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Now
              </p>
              <p className="mt-1 text-sm font-medium leading-snug text-neutral-800 dark:text-neutral-200">
                {current.summary}
              </p>
            </div>
            {next && (
              <span className="mt-4 shrink-0 px-1.5 text-neutral-300 dark:text-neutral-700">→</span>
            )}
          </>
        )}

        {next && (
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Next
            </p>
            <p className="mt-1 text-sm leading-snug text-neutral-500 dark:text-neutral-500">
              {next.summary}
            </p>
          </div>
        )}
      </div>

      {/* Bridge recommendation */}
      {bridgeRecommendation && (
        <div className="mt-4 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3.5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            {bridgeRecommendation}
          </p>
        </div>
      )}
    </section>
  );
}
