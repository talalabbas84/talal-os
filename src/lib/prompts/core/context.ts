import type { PromptContext, PromptSection } from "../builders/types";

export const ContextPrompt: PromptSection = {
  name: "Context Contract",
  version: "1.0",
  description: "Defines context slots that may be injected into composed prompts.",
  content: `Available context may include:
- Current State
- Memory
- Projects
- Habits
- Today's Tasks
- People Context
- Recent Captures

Use only the context provided. If a section is empty, do not invent it.`,
};

export function formatPromptContext(context?: PromptContext | string): string {
  if (!context) return "No additional context was provided.";
  if (typeof context === "string") return context.trim() || "No additional context was provided.";

  const sections: Array<[string, string | undefined]> = [
    ["Current State", context.currentState],
    ["Memory", context.memory],
    ["Projects", context.projects],
    ["Habits", context.habits],
    ["Today's Tasks", context.todaysTasks],
    ["People Context", context.peopleContext],
    ["Recent Captures", context.recentCaptures],
    ["Raw Context", context.raw],
  ];

  const rendered = sections
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `## ${label}\n${value!.trim()}`);

  return rendered.length > 0 ? rendered.join("\n\n") : "No additional context was provided.";
}
