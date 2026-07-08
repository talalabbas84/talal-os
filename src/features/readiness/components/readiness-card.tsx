"use client";

import { scoreToPercent, scoreToLevel, getReadinessColor, getReadinessLabel, computeReadinessScore } from "@/lib/readiness/readiness-score";
import { cn } from "@/utils/cn";
import type { ReadinessPlanData } from "@/lib/readiness/readiness-types";

function formatRelativeTime(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin <= 0) return "Now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffH < 24) return remMin > 0 ? `${diffH}h ${remMin}m` : `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

export function ReadinessCard({ plan, now }: { plan: ReadinessPlanData; now: Date }) {
  const score = computeReadinessScore(plan.preparedItems, plan.missingItems);
  const level = scoreToLevel(score);
  const pct = scoreToPercent(score);
  const colorClass = getReadinessColor(level);
  const label = getReadinessLabel(level);
  const timeLeft = formatRelativeTime(plan.scheduledFor, now);
  const hoursLeft = (plan.scheduledFor.getTime() - now.getTime()) / 3_600_000;

  // Simplify display as event gets closer
  const isIminent = hoursLeft < 1;
  const showMissing = !isIminent && plan.missingItems.length > 0;
  const topMissing = plan.missingItems
    .sort((a, b) => (a.priority === "high" ? -1 : b.priority === "high" ? 1 : 0))
    .slice(0, isIminent ? 1 : 3);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {plan.title}
          </p>
          <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
            Starts in{" "}
            <span className="font-medium text-neutral-600 dark:text-neutral-400">{timeLeft}</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-lg font-bold tabular-nums", colorClass)}>{pct}%</p>
          <p className="text-xs text-neutral-400">{label}</p>
        </div>
      </div>

      {/* Prepared items (iminent: show focus only) */}
      {isIminent && plan.focusTip && (
        <div className="mt-4 rounded-xl border border-green-100 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950/20">
          <p className="text-xs font-medium text-green-700 dark:text-green-400">Focus</p>
          <p className="mt-0.5 text-sm leading-6 text-green-900 dark:text-green-200">{plan.focusTip}</p>
        </div>
      )}

      {/* Missing items */}
      {showMissing && (
        <div className="mt-4 space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Still missing</p>
          {topMissing.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                item.priority === "high" ? "bg-red-400" : "bg-amber-300",
              )} />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Prepared items */}
      {!isIminent && plan.preparedItems.length > 0 && (
        <div className="mt-3 space-y-1">
          {plan.preparedItems.slice(0, 2).map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Focus tip — when not iminent and few missing items */}
      {!isIminent && plan.focusTip && plan.missingItems.filter(m => m.priority === "high").length === 0 && (
        <p className="mt-3 text-xs italic text-neutral-400 dark:text-neutral-500">
          💡 {plan.focusTip}
        </p>
      )}

      {/* Top recommendation */}
      {!isIminent && plan.recommendations[0] && (
        <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-xs text-neutral-400">{plan.recommendations[0].context}</p>
          <p className="mt-0.5 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
            {plan.recommendations[0].text.slice(0, 100)}
          </p>
        </div>
      )}
    </div>
  );
}
