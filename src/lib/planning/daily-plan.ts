import {
  buildMorningPlan,
  generateMorningPlan,
  type DailyPlan,
  type FollowUpSummary,
} from "@/lib/intelligence/morning-planning-engine";

export type { DailyPlan, FollowUpSummary };

export async function buildDailyPlan(userId: string): Promise<DailyPlan> {
  return buildMorningPlan(userId, { persist: false });
}

export async function generateDailyPlan(userId: string): Promise<DailyPlan> {
  return generateMorningPlan(userId);
}
