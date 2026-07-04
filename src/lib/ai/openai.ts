import type { AIProvider, CaptureResult } from "./types";

// Stub — implement with OPENAI_API_KEY when ready
export const openaiProvider: AIProvider = {
  async organizeCapture(_input: string): Promise<CaptureResult> {
    throw new Error(
      "OpenAI provider not yet implemented. Set AI_PROVIDER=mock or AI_PROVIDER=gemini.",
    );
  },
};
