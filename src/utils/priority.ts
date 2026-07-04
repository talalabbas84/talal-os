// Priority score: urgency + importance - energy penalty
// Range: 0 (lowest) → 6 (highest)
//   urgency    LOW=1, MEDIUM=2, HIGH=3
//   importance LOW=1, MEDIUM=2, HIGH=3
//   energy     LOW=0, MEDIUM=1, HIGH=2  (penalty — more effort = lower score)

type Level = "LOW" | "MEDIUM" | "HIGH";

const URGENCY_SCORE: Record<Level, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const IMPORTANCE_SCORE: Record<Level, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const ENERGY_PENALTY: Record<Level, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

export function computePriorityScore(
  urgency: Level,
  importance: Level,
  energyRequired: Level,
): number {
  return (
    URGENCY_SCORE[urgency] +
    IMPORTANCE_SCORE[importance] -
    ENERGY_PENALTY[energyRequired]
  );
}
