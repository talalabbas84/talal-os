import { getAIProvider } from "@/lib/ai/provider";
import type { IntentResult } from "./types";

// Classifies a capture into a single intent.
// Runs BEFORE the full context is built — keeps it fast.
export async function routeIntent(
  text: string,
  contextSummary?: string,
): Promise<IntentResult> {
  const provider = getAIProvider();
  return provider.classifyIntent(text, contextSummary);
}
