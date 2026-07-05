// Thin wrapper over daily-plan — extension point for weekly planning later.
import { buildDailyPlan } from "@/lib/planning/daily-plan";
import type { PlanSummary } from "./types";

export async function runPlanningEngine(userId: string): Promise<PlanSummary> {
  const plan = await buildDailyPlan(userId);
  return {
    topTasks: plan.topTasks,
    habitsDue: plan.habitsDue,
    overdueCount: plan.overdueCount,
    suggestion: plan.suggestion,
  };
}
