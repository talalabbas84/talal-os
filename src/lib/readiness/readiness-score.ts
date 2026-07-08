import type { MissingItem, PreparedItem, ReadinessLevel } from "./readiness-types";

// Score = prepared / (prepared + weighted_missing)
// Missing HIGH = 1.0, MEDIUM = 0.6, LOW = 0.3 weight
export function computeReadinessScore(prepared: PreparedItem[], missing: MissingItem[]): number {
  if (prepared.length === 0 && missing.length === 0) return 1;

  const preparedWeight = prepared.length;
  const missingWeight = missing.reduce((acc, m) => {
    if (m.priority === "high") return acc + 1.0;
    if (m.priority === "medium") return acc + 0.6;
    return acc + 0.3;
  }, 0);

  const total = preparedWeight + missingWeight;
  if (total === 0) return 1;
  return preparedWeight / total;
}

export function scoreToLevel(score: number): ReadinessLevel {
  if (score >= 0.8) return "HIGH";
  if (score >= 0.5) return "MEDIUM";
  return "LOW";
}

export function scoreToPercent(score: number): number {
  return Math.round(score * 100);
}

export function getReadinessColor(level: ReadinessLevel): string {
  if (level === "HIGH") return "text-green-600 dark:text-green-400";
  if (level === "MEDIUM") return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

export function getReadinessLabel(level: ReadinessLevel): string {
  if (level === "HIGH") return "Ready";
  if (level === "MEDIUM") return "Getting there";
  return "Not started";
}
