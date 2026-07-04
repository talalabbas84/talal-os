import type { AIProvider, CaptureResult } from "./types";

// Stub — implement when self-hosting Ollama with OLLAMA_BASE_URL + OLLAMA_MODEL
export const ollamaProvider: AIProvider = {
  async organizeCapture(_input: string): Promise<CaptureResult> {
    throw new Error(
      "Ollama provider not yet implemented. Set AI_PROVIDER=mock or AI_PROVIDER=gemini.",
    );
  },
};
