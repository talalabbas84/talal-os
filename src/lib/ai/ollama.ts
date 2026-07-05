import type { AIProvider, CaptureResult, IntentResultOutput, RecommendationOutput, ReflectionResultOutput } from "./types";

const NOT_IMPLEMENTED = "Ollama provider not yet implemented. Set AI_PROVIDER=mock or AI_PROVIDER=gemini.";

// Stub — implement when self-hosting Ollama with OLLAMA_BASE_URL + OLLAMA_MODEL
export const ollamaProvider: AIProvider = {
  async organizeCapture(): Promise<CaptureResult> { throw new Error(NOT_IMPLEMENTED); },
  async classifyIntent(): Promise<IntentResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateRecommendation(): Promise<RecommendationOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateReflection(): Promise<ReflectionResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async answerQuestion(): Promise<string> { throw new Error(NOT_IMPLEMENTED); },
};
