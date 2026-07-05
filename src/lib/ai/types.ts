import type { CaptureResult } from "./schema";

// Re-export all schema types so consumers import from one place
export type {
  CaptureResult,
  CaptureData,
  TaskOutput,
  IdeaOutput,
  JournalOutput,
  HabitOutput,
  ProjectOutput,
  ReminderOutput,
  MemoryCandidateOutput,
  CommandOutput,
  Confidence,
} from "./schema";

// The single contract every provider must implement.
// The application never knows which provider is running.
export interface AIProvider {
  organizeCapture(input: string, contextPrompt?: string): Promise<CaptureResult>;
}
