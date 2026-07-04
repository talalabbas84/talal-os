import type { AIProvider, CaptureOutput } from "./types";

// Stub — implement with OPENROUTER_API_KEY when ready
export const openrouterProvider: AIProvider = {
  async processCapture(_text: string): Promise<CaptureOutput> {
    throw new Error("OpenRouter provider not yet implemented. Set AI_PROVIDER=mock to use the mock provider.");
  },
};
