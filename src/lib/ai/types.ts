import type { CaptureResult, IntentResultOutput, RecommendationOutput, ReflectionResultOutput } from "./schema";

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
  IntentResultOutput,
  RecommendationOutput,
  ReflectionResultOutput,
} from "./schema";

// The single contract every provider must implement.
// The application never knows which provider is running.
export interface AIProvider {
  // Core organize flow (CREATE intent)
  organizeCapture(input: string, contextPrompt?: string): Promise<CaptureResult>;
  // Lightweight intent classification — runs before full context is built
  classifyIntent(text: string, contextSummary?: string): Promise<IntentResultOutput>;
  // DECISION flow — needs full context to recommend
  generateRecommendation(text: string, contextPrompt: string): Promise<RecommendationOutput>;
  // REFLECTION / JOURNAL flow
  generateReflection(text: string): Promise<ReflectionResultOutput>;
  // QUESTION flow — needs context to answer
  answerQuestion(text: string, contextPrompt: string): Promise<string>;
}
