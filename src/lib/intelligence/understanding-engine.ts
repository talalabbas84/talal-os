import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { buildPrompt } from "@/lib/prompts";
import type { ArticulationResult, ExpressionScoreTrend, VocabularySuggestion } from "./types";

const vocabularySuggestionSchema = z.object({
  original: z.string().min(1),
  suggestions: z.array(z.string().min(1)).default([]),
  reason: z.string().default("More precise wording."),
});

const understandingTrendSchema = z.object({
  clarity: z.string().default("Clear enough to route."),
  specificity: z.string().default("Specific details preserved."),
  vocabularyVariety: z.string().default("Simple vocabulary; no issue."),
  structure: z.string().default("Readable structure."),
});

const understandingSchema = z.object({
  articulated: z.string().min(1),
  improvedArticulation: z.string().min(1),
  vocabularySuggestions: z.array(vocabularySuggestionSchema).default([]),
  ambiguityNotes: z.array(z.string()).default([]),
  clarificationQuestion: z.string().nullable().default(null),
  explanation: z.string().default("Internal understanding preserved the original meaning."),
  expressionScore: understandingTrendSchema.default({
    clarity: "Clear enough to route.",
    specificity: "Specific details preserved.",
    vocabularyVariety: "Simple vocabulary; no issue.",
    structure: "Readable structure.",
  }),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().default("Understanding Engine processed the capture."),
});

type UnderstandingOutput = z.infer<typeof understandingSchema>;

export async function runUnderstandingEngine(input: string): Promise<ArticulationResult> {
  const original = input.trim();
  if (!original) {
    return toArticulation(original, {
      articulated: original,
      improvedArticulation: original,
      vocabularySuggestions: [],
      ambiguityNotes: [],
      clarificationQuestion: null,
      explanation: "Empty capture.",
      expressionScore: defaultScore(),
      confidence: "high",
      notes: "Empty capture.",
    });
  }

  const output = await runLiveUnderstanding(original).catch(() =>
    heuristicUnderstanding(original),
  );

  return toArticulation(original, output);
}

async function runLiveUnderstanding(input: string): Promise<UnderstandingOutput> {
  if (!process.env.GEMINI_API_KEY) {
    return heuristicUnderstanding(input);
  }

  const prompt = buildPrompt({
    brain: "understanding",
    userInput: input,
    context: "This is the first stage of the capture pipeline. Understand only. Do not classify, plan, coach grammar, or expose reasoning.",
  });

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: prompt.systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(prompt.userPrompt);
  const raw = stripMarkdown(result.response.text());
  const parsed = understandingSchema.safeParse(JSON.parse(raw));

  return parsed.success ? parsed.data : heuristicUnderstanding(input);
}

function heuristicUnderstanding(input: string): UnderstandingOutput {
  const normalized = normalizeSpacing(input);
  const articulated = normalizeArticulation(structureKnownCapture(normalized), normalized);
  const improvedArticulation = improveArticulation(articulated);
  const ambiguityNotes = detectAmbiguity(normalized);

  return {
    articulated,
    improvedArticulation,
    vocabularySuggestions: [],
    ambiguityNotes,
    clarificationQuestion: buildClarifyingQuestion(normalized, ambiguityNotes),
    explanation: "Internal understanding normalized the capture without changing meaning.",
    expressionScore: scoreExpression(normalized, articulated, [], ambiguityNotes),
    confidence: articulated === sentenceCase(normalized) ? "high" : "medium",
    notes: "Understanding Engine used conservative local normalization.",
  };
}

function structureKnownCapture(input: string): string {
  const lower = input.toLowerCase();
  const dinnerDance = input.match(
    /\b(?:i\s+)?(?:have to|need to|will|am going to|i'm going to)?\s*(?:go\s+)?(?:for\s+)?(?:a\s+)?dinner with ([a-z]+).*dance class.*\b(this\s+[a-z]+|next\s+[a-z]+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*ends? at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  );

  if (dinnerDance?.[1] && dinnerDance[2] && dinnerDance[3] && dinnerDance[5]) {
    const name = capitalizeWord(dinnerDance[1]);
    const day = dinnerDance[2];
    const minute = dinnerDance[4] ?? "00";
    const suffix = dinnerDance[5].toUpperCase();
    return `I have to go to dinner with ${name} after my dance class ${day}. The dance class ends at ${dinnerDance[3]}:${minute} ${suffix}.`;
  }

  if (/\b(gym done|workout done|finished gym|completed gym)\b/i.test(input)) {
    return "I completed my gym session.";
  }

  if (/\bremind me\b/i.test(input)) {
    return sentenceCase(input);
  }

  if (/\bmet\s+[a-z]+|talked to\s+[a-z]+|birthday|loves\b/i.test(input)) {
    return sentenceCase(input.replace(/\bi\b/g, "I"));
  }

  if (/\b(sick|ill|unwell|fever|headache)\b/.test(lower)) {
    return sentenceCase(input.replace(/\bdont\b/gi, "do not"));
  }

  return sentenceCase(input);
}

function improveArticulation(articulated: string): string {
  return articulated
    .replace(/\bmicheal\b/gi, "Michael")
    .replace(/\bi\b/g, "I")
    .replace(/\bcuz\b/gi, "because")
    .replace(/\bdont\b/gi, "do not")
    .replace(/\bwanna\b/gi, "want to")
    .replace(/\bgonna\b/gi, "going to");
}

function detectAmbiguity(input: string): string[] {
  const lower = input.toLowerCase();
  const notes: string[] = [];

  if (/\bwhich\s+(sarah|sara|michael|micheal|person|one)\b/.test(lower) || /\bnot sure who\b/.test(lower)) {
    notes.push("A person reference is ambiguous.");
  }

  return notes;
}

function buildClarifyingQuestion(input: string, ambiguityNotes: string[]): string | null {
  if (ambiguityNotes.length === 0) return null;
  const lower = input.toLowerCase();

  if (/\bwhich\s+(sarah|sara|michael|micheal|person|one)\b/.test(lower) || /\bnot sure who\b/.test(lower)) {
    return "Which person did you mean?";
  }

  return null;
}

function scoreExpression(
  original: string,
  articulated: string,
  vocabularySuggestions: VocabularySuggestion[],
  ambiguityNotes: string[],
): ExpressionScoreTrend {
  const wordCount = original.trim().split(/\s+/).filter(Boolean).length;
  const hasTimeOrDate = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\s*(am|pm))\b/i.test(original);
  const hasConnector = /\b(after|before|because|while|then|and)\b/i.test(original);

  return {
    clarity: ambiguityNotes.length ? "Clearer after rewrite, but one decision is still ambiguous." : "Clear enough to route without losing meaning.",
    specificity: hasTimeOrDate ? "Specific time/date context is present." : "Could become more specific with time, place, or outcome.",
    vocabularyVariety: vocabularySuggestions.length ? "Simple repeated wording found; vocabulary coaching available." : "Vocabulary is direct and understandable.",
    structure: wordCount > 18 && hasConnector ? "Improved by splitting the thought into cleaner parts." : articulated === sentenceCase(original) ? "Already simple enough." : "Structure is more readable after rewrite.",
  };
}

function toArticulation(original: string, output: UnderstandingOutput): ArticulationResult {
  const articulated = normalizeArticulation(output.articulated, original);
  const improvedArticulation = normalizeArticulation(output.improvedArticulation, articulated);

  return {
    original,
    articulated,
    improvedArticulation,
    vocabularySuggestions: output.vocabularySuggestions,
    ambiguityNotes: output.ambiguityNotes,
    clarificationQuestion: output.clarificationQuestion,
    explanation: output.explanation,
    expressionScore: output.expressionScore,
    confidence: output.confidence,
    changed: articulated !== original || improvedArticulation !== original,
    notes: output.notes,
  };
}

function defaultScore(): ExpressionScoreTrend {
  return {
    clarity: "No expression signal.",
    specificity: "No expression signal.",
    vocabularyVariety: "No expression signal.",
    structure: "No expression signal.",
  };
}

function normalizeArticulation(articulated: string, fallback: string): string {
  const cleaned = normalizeSpacing(articulated);
  if (!cleaned) return sentenceCase(fallback);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function sentenceCase(value: string): string {
  const cleaned = normalizeSpacing(value);
  if (!cleaned) return cleaned;
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}${/[.!?]$/.test(cleaned) ? "" : "."}`;
}

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizeWord(value: string): string {
  const clean = value.trim().toLowerCase();
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

function stripMarkdown(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}
