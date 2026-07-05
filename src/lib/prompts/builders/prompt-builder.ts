import {
  ContextPrompt,
  FormattingPrompt,
  IdentityPrompt,
  PhilosophyPrompt,
  SafetyPrompt,
  SystemPrompt,
} from "../core";
import { getBrainPrompt } from "../brains";
import { buildPromptContext, estimateTokenCount } from "./context-builder";
import type { BuildPromptInput, BuiltPrompt, PromptSection } from "./types";

const CORE_SECTIONS: PromptSection[] = [
  SystemPrompt,
  IdentityPrompt,
  PhilosophyPrompt,
  FormattingPrompt,
  SafetyPrompt,
  ContextPrompt,
];

function renderSection(section: PromptSection): string {
  return `## ${section.name} v${section.version}\n${section.content}`;
}

export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const brainPrompt = getBrainPrompt(input.brain);
  const context = buildPromptContext({
    context: input.context,
    memories: input.memories,
    currentState: input.currentState,
  });

  const systemPrompt = [
    ...CORE_SECTIONS.map(renderSection),
    `## ${brainPrompt.name} v${brainPrompt.version}
Tone: ${brainPrompt.tone}
Focus: ${brainPrompt.focus}
${brainPrompt.content}`,
  ].join("\n\n---\n\n");

  const userPrompt = `## User Input
${input.userInput.trim() || "(empty)"}

## Provided Context
${context}`;

  return {
    systemPrompt,
    userPrompt,
    metadata: {
      brain: input.brain,
      brainPrompt: {
        name: brainPrompt.name,
        version: brainPrompt.version,
        description: brainPrompt.description,
      },
      sections: CORE_SECTIONS.map((section) => ({
        name: section.name,
        version: section.version,
        description: section.description,
      })),
      estimatedTokens: estimateTokenCount(`${systemPrompt}\n\n${userPrompt}`),
    },
  };
}

export function listPromptSections(): PromptSection[] {
  return [...CORE_SECTIONS];
}
