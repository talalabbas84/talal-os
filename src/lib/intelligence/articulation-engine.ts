import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { buildPrompt } from "@/lib/prompts";
import type { ArticulationResult } from "./types";

const articulationSchema = z.object({
  articulated: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().default("Clarified wording while preserving meaning."),
});

type ArticulationOutput = z.infer<typeof articulationSchema>;

export async function articulateCapture(input: string): Promise<ArticulationResult> {
  const original = input.trim();
  if (!original) {
    return {
      original,
      articulated: original,
      confidence: "high",
      changed: false,
      notes: "Empty capture.",
    };
  }

  const output = await runLiveArticulation(original).catch(() =>
    heuristicArticulation(original),
  );
  const articulated = normalizeArticulation(output.articulated, original);

  return {
    original,
    articulated,
    confidence: output.confidence,
    changed: articulated !== original,
    notes: output.notes,
  };
}

async function runLiveArticulation(input: string): Promise<ArticulationOutput> {
  if (!process.env.GEMINI_API_KEY) {
    return heuristicArticulation(input);
  }

  const prompt = buildPrompt({
    brain: "articulation",
    userInput: input,
    context:
      "This is the first stage of the capture pipeline. Rewrite only. Do not classify, plan, or execute.",
  });

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: prompt.systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(prompt.userPrompt);
  const raw = stripMarkdown(result.response.text());
  const parsed = articulationSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    return heuristicArticulation(input);
  }

  return parsed.data;
}

function heuristicArticulation(input: string): ArticulationOutput {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  const parts: string[] = [];

  if (/\bsick|ill|unwell|fever|headache\b/.test(lower)) {
    parts.push("I am feeling sick or unwell.");
  }

  const personMatch = trimmed.match(/\b(?:met|talked to|spoke with)?\s*([A-Z][a-z]+)\b/);
  if (personMatch?.[1] && /\bmet|talked|spoke|birthday|loves|performance\b/i.test(trimmed)) {
    parts.push(`I mentioned ${personMatch[1]} and want to preserve the relevant relationship context.`);
  }

  if (/\bbirthday\b|\bjune\s*5\b|\bjune5\b/i.test(trimmed)) {
    parts.push("There may be a birthday detail to remember.");
  }

  if (/\bremind me|reminder|ask\b/i.test(trimmed)) {
    parts.push("I may want a reminder or follow-up task.");
  }

  if (/\bgym|workout|groceries|grocery|dance|task|tomorrow\b/i.test(trimmed)) {
    const taskBits: string[] = [];
    if (/\bgym|workout\b/i.test(trimmed)) taskBits.push("gym");
    if (/\bgroceries|grocery\b/i.test(trimmed)) taskBits.push("groceries");
    if (/\bdance\b/i.test(trimmed)) taskBits.push("dance");
    const date = /\btomorrow\b/i.test(trimmed) ? " for tomorrow" : "";
    if (taskBits.length) {
      parts.push(`I am thinking about ${taskBits.join(", ")}${date}.`);
    }
  }

  const articulated =
    parts.length > 0
      ? parts.join(" ")
      : sentenceCase(trimmed);

  return {
    articulated,
    confidence: parts.length > 0 ? "medium" : "high",
    notes:
      parts.length > 0
        ? "Applied conservative local clarification because live articulation was unavailable."
        : "Input was lightly normalized.",
  };
}

function normalizeArticulation(articulated: string, fallback: string): string {
  const cleaned = articulated.trim().replace(/\s+/g, " ");
  if (!cleaned) return sentenceCase(fallback);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function sentenceCase(value: string): string {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}${/[.!?]$/.test(cleaned) ? "" : "."}`;
}

function stripMarkdown(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}
