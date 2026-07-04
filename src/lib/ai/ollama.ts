import type { AIProvider, CaptureOutput } from "./types";

// Stub — implement when self-hosting Ollama locally
export const ollamaProvider: AIProvider = {
  async processCapture(_text: string): Promise<CaptureOutput> {
    throw new Error("Ollama provider not yet implemented. Set AI_PROVIDER=mock to use the mock provider.");
  },
};
