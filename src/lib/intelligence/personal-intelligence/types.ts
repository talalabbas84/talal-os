import type { CaptureResult } from "@/lib/ai/types";
import type { PlannedAction } from "@/lib/intelligence/types";

export interface PersonalIntelligenceInput {
  userId: string;
  rawText: string;
  cleanedText: string;
  capture?: CaptureResult | null;
  existingActions?: PlannedAction[];
}

export interface Signal {
  key: string;
  matched: boolean;
  evidence: string;
}

export function makePersonalActionId(prefix: string, text: string): string {
  const hash = Array.from(text).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);
  return `${prefix}-${Math.abs(hash)}`;
}
