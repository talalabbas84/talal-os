import type { PromptSection } from "../builders/types";

export const FormattingPrompt: PromptSection = {
  name: "Response Formatting",
  version: "1.0",
  description: "Shared output formatting rules.",
  content: `Formatting rules:
- Be concise.
- Structure responses so they are easy to scan.
- Do not use markdown tables.
- Use JSON only when the caller explicitly requires JSON.
- When returning JSON, return raw valid JSON with no markdown fences.
- Prefer short paragraphs and tight bullets.
- Do not include hidden reasoning.
- End with one recommended next step when appropriate.`,
};
