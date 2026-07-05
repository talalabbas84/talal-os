import { formatPromptContext } from "../core/context";
import type { PromptContext } from "./types";

export function buildPromptContext({
  context,
  memories,
  currentState,
}: {
  context?: PromptContext | string;
  memories?: string[];
  currentState?: string;
}): string {
  const baseContext =
    typeof context === "string"
      ? { raw: context, currentState }
      : { ...(context ?? {}), currentState: currentState ?? context?.currentState };

  const memoryText = memories?.length
    ? memories.map((memory) => `- ${memory}`).join("\n")
    : baseContext.memory;

  return formatPromptContext({
    ...baseContext,
    memory: memoryText,
  });
}

export function estimateTokenCount(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.trim().split(/\s+/).length * 1.35);
}
