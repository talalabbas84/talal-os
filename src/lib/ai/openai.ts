import type { AIProvider, CaptureResult, IntentResultOutput, RecommendationOutput, ReflectionResultOutput } from "./types";

const NOT_IMPLEMENTED = "OpenAI provider not yet implemented. Set AI_PROVIDER=mock or AI_PROVIDER=gemini.";

// Stub — implement with OPENAI_API_KEY when ready
export const openaiProvider: AIProvider = {
  async organizeCapture(): Promise<CaptureResult> { throw new Error(NOT_IMPLEMENTED); },
  async classifyIntent(): Promise<IntentResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateRecommendation(): Promise<RecommendationOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateReflection(): Promise<ReflectionResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async answerQuestion(): Promise<string> { throw new Error(NOT_IMPLEMENTED); },
};
