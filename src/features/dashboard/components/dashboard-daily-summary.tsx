import { AlertCircle, Repeat2, BookOpen } from "lucide-react";
import type { DailyPlan } from "@/lib/planning/daily-plan";
import { cn } from "@/utils/cn";

export function DashboardDailySummary({ plan }: { plan: DailyPlan }) {
  const habitsDue = plan.habitsDue.length;
  const pendingHabits = habitsDue; // habitsDue already filters to incomplete in buildDailyPlan

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      {plan.suggestion && (
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {plan.suggestion}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {plan.overdueCount > 0 && (
          <StatChip
            icon={AlertCircle}
            label={`${plan.overdueCount} overdue`}
            color="red"
          />
        )}
        {pendingHabits > 0 && (
          <StatChip
            icon={Repeat2}
            label={`${pendingHabits} habit${pendingHabits !== 1 ? "s" : ""} pending`}
            color="amber"
          />
        )}
        {!plan.journalFilled && (
          <StatChip
            icon={BookOpen}
            label="Log not filled"
            color="neutral"
          />
        )}
        {plan.overdueCount === 0 && pendingHabits === 0 && plan.journalFilled && (
          <span className="text-xs text-neutral-400">All clear for today.</span>
        )}
      </div>
    </div>
  );
}

type ChipColor = "red" | "amber" | "neutral";

const CHIP_STYLES: Record<ChipColor, string> = {
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  neutral: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

function StatChip({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ElementType;
  label: string;
  color: ChipColor;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        CHIP_STYLES[color],
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
