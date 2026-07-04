import type { AIProvider, CaptureOutput } from "./types";

// Stub — implement with GEMINI_API_KEY when ready
export const geminiProvider: AIProvider = {
  async processCapture(_text: string): Promise<CaptureOutput> {
    throw new Error("Gemini provider not yet implemented. Set AI_PROVIDER=mock to use the mock provider.");
  },
};
