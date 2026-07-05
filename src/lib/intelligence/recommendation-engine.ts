import { getAIProvider } from "@/lib/ai/provider";
import type { Recommendation } from "./types";

export async function generateRecommendation(
  text: string,
  contextPrompt: string,
): Promise<Recommendation> {
  const provider = getAIProvider();
  const output = await provider.generateRecommendation(text, contextPrompt);
  return {
    summary: output.summary,
    reasoning: output.reasoning,
    topTask: output.topTask,
    thingsToIgnore: output.thingsToIgnore,
    suggestedMode: output.suggestedMode,
  };
}
