import type { AIProvider } from "./types";

// The application uses this function exclusively.
// Which provider runs is determined solely by AI_PROVIDER.
// Adding a new provider never requires touching application code.
export function getAIProvider(): AIProvider {
  const name = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  switch (name) {
    case "mock": {
      const { mockProvider } = require("./mock") as typeof import("./mock");
      return mockProvider;
    }
    case "gemini": {
      const { geminiProvider } = require("./gemini") as typeof import("./gemini");
      return geminiProvider;
    }
    case "openai": {
      const { openaiProvider } = require("./openai") as typeof import("./openai");
      return openaiProvider;
    }
    case "ollama": {
      const { ollamaProvider } = require("./ollama") as typeof import("./ollama");
      return ollamaProvider;
    }
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${name}". Valid options: mock, gemini, openai, ollama`,
      );
  }
}
