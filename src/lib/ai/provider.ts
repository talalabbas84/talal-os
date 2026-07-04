import type { AIProvider } from "./types";

export function getAIProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "mock";

  switch (name) {
    case "mock": {
      const { mockProvider } = require("./mock") as typeof import("./mock");
      return mockProvider;
    }
    case "ollama": {
      const { ollamaProvider } = require("./ollama") as typeof import("./ollama");
      return ollamaProvider;
    }
    case "openrouter": {
      const { openrouterProvider } = require("./openrouter") as typeof import("./openrouter");
      return openrouterProvider;
    }
    case "gemini": {
      const { geminiProvider } = require("./gemini") as typeof import("./gemini");
      return geminiProvider;
    }
    default:
      throw new Error(`Unknown AI_PROVIDER: "${name}". Valid options: mock, ollama, openrouter, gemini`);
  }
}
