import { runExpressionBrain } from "./expression-brain";
import type { ArticulationResult } from "./types";

export async function articulateCapture(input: string, userId?: string): Promise<ArticulationResult> {
  return runExpressionBrain(input, userId);
}
