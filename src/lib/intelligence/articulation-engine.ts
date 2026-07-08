import { runUnderstandingEngine } from "./understanding-engine";
import type { ArticulationResult } from "./types";

export async function articulateCapture(input: string): Promise<ArticulationResult> {
  return runUnderstandingEngine(input);
}
