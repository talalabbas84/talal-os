import { Activity, Zap, Target, Shield } from "lucide-react";
import type { UserState } from "@prisma/client";
import { cn } from "@/utils/cn";

const LEVEL_COLORS: Record<string, string> = {
  HIGH: "text-green-600 dark:text-green-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  LOW: "text-red-600 dark:text-red-400",
};

export function DashboardUserState({ state }: { state: UserState | null }) {
  if (!state) return null;

  const hasSomething =
    state.recoveryMode ||
    state.currentMood ||
    state.currentMission ||
    state.energyLevel ||
    state.focusLevel;

  if (!hasSomething) return null;

  return (
    <div className={cn(
      "rounded-xl border p-4",
      state.recoveryMode
        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
        : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
    )}>
      <div className="flex flex-wrap items-center gap-3">
        {state.recoveryMode && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
            <Shield className="h-3 w-3" />
            Recovery Mode
          </span>
        )}

        {state.currentMood && (
          <span className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            <Activity className="h-3.5 w-3.5" />
            {state.currentMood}
          </span>
        )}

        {state.energyLevel && (
          <span className={cn("flex items-center gap-1 text-xs font-medium", LEVEL_COLORS[state.energyLevel] ?? "")}>
            <Zap className="h-3 w-3" />
            Energy: {state.energyLevel}
          </span>
        )}

        {state.currentMission && (
          <span className="flex items-center gap-1.5 text-sm text-neutral-700 dark:text-neutral-300">
            <Target className="h-3.5 w-3.5 text-neutral-400" />
            {state.currentMission}
          </span>
        )}
      </div>
    </div>
  );
}
