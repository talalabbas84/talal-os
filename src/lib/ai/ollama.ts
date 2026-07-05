import type { AIProvider, CaptureResult, IntentResultOutput, RecommendationOutput, ReflectionResultOutput } from "./types";

const NOT_IMPLEMENTED = "Ollama provider not yet implemented. Set AI_PROVIDER=mock or AI_PROVIDER=gemini.";

// Stub — implement when self-hosting Ollama with OLLAMA_BASE_URL + OLLAMA_MODEL
export const ollamaProvider: AIProvider = {
  async organizeCapture(_input: string): Promise<CaptureResult> { throw new Error(NOT_IMPLEMENTED); },
  async classifyIntent(_text: string): Promise<IntentResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateRecommendation(_text: string, _ctx: string): Promise<RecommendationOutput> { throw new Error(NOT_IMPLEMENTED); },
  async generateReflection(_text: string): Promise<ReflectionResultOutput> { throw new Error(NOT_IMPLEMENTED); },
  async answerQuestion(_text: string, _ctx: string): Promise<string> { throw new Error(NOT_IMPLEMENTED); },
};
