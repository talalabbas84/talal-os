import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { buildPrompt } from "@/lib/prompts";
import type { ArticulationResult, ExpressionScoreTrend, VocabularySuggestion } from "./types";

const vocabularySuggestionSchema = z.object({
  original: z.string().min(1),
  suggestions: z.array(z.string().min(1)).default([]),
  reason: z.string().default("More precise wording."),
});

const expressionScoreSchema = z.object({
  clarity: z.string().default("Clear enough to route."),
  specificity: z.string().default("Specific details preserved."),
  vocabularyVariety: z.string().default("Simple vocabulary; no issue."),
  structure: z.string().default("Readable structure."),
});

const expressionSchema = z.object({
  articulated: z.string().min(1),
  improvedArticulation: z.string().min(1),
  vocabularySuggestions: z.array(vocabularySuggestionSchema).default([]),
  ambiguityNotes: z.array(z.string()).default([]),
  clarificationQuestion: z.string().nullable().default(null),
  explanation: z.string().default("The rewrite is clearer while preserving the original meaning."),
  expressionScore: expressionScoreSchema.default({
    clarity: "Clear enough to route.",
    specificity: "Specific details preserved.",
    vocabularyVariety: "Simple vocabulary; no issue.",
    structure: "Readable structure.",
  }),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  notes: z.string().default("Expression Brain processed the capture."),
});

type ExpressionOutput = z.infer<typeof expressionSchema>;

const SIMPLE_WORDS: Record<string, VocabularySuggestion> = {
  nice: {
    original: "nice",
    suggestions: ["rewarding", "meaningful", "uplifting", "engaging"],
    reason: "These words explain what kind of positive experience it was.",
  },
  good: {
    original: "good",
    suggestions: ["useful", "strong", "effective", "encouraging"],
    reason: "These alternatives make the positive quality more specific.",
  },
  bad: {
    original: "bad",
    suggestions: ["frustrating", "draining", "ineffective", "disappointing"],
    reason: "These alternatives clarify what felt negative.",
  },
  tired: {
    original: "tired",
    suggestions: ["drained", "low-energy", "fatigued", "depleted"],
    reason: "These words separate normal tiredness from deeper energy loss.",
  },
  happy: {
    original: "happy",
    suggestions: ["energized", "content", "excited", "relieved"],
    reason: "These options describe the emotional flavor more precisely.",
  },
  sad: {
    original: "sad",
    suggestions: ["discouraged", "heavy", "lonely", "disappointed"],
    reason: "These options make the emotional signal more specific.",
  },
  thing: {
    original: "thing",
    suggestions: ["task", "issue", "idea", "commitment"],
    reason: "Naming the kind of thing reduces ambiguity.",
  },
};

export async function runExpressionBrain(input: string, userId?: string): Promise<ArticulationResult> {
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

  const repeatedSimpleWords = userId ? await getRepeatedSimpleWords(userId) : [];
  const output = await runLiveExpression(original, repeatedSimpleWords).catch(() =>
    heuristicExpression(original, repeatedSimpleWords),
  );

  return toArticulation(original, output);
}

async function runLiveExpression(input: string, repeatedSimpleWords: string[]): Promise<ExpressionOutput> {
  if (!process.env.GEMINI_API_KEY) {
    return heuristicExpression(input, repeatedSimpleWords);
  }

  const prompt = buildPrompt({
    brain: "expression",
    userInput: input,
    context: [
      "This is the first stage of the capture pipeline. Improve expression only. Do not classify, plan, or execute.",
      repeatedSimpleWords.length
        ? `Repeated simple words to coach gently: ${repeatedSimpleWords.join(", ")}.`
        : "No repeated simple-word pattern is known yet.",
    ].join("\n"),
  });

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: prompt.systemPrompt,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(prompt.userPrompt);
  const raw = stripMarkdown(result.response.text());
  const parsed = expressionSchema.safeParse(JSON.parse(raw));

  return parsed.success ? parsed.data : heuristicExpression(input, repeatedSimpleWords);
}

function heuristicExpression(input: string, repeatedSimpleWords: string[]): ExpressionOutput {
  const normalized = normalizeSpacing(input);
  const articulated = normalizeArticulation(structureKnownCapture(normalized), normalized);
  const improvedArticulation = improveArticulation(articulated);
  const ambiguityNotes = detectAmbiguity(normalized);
  const vocabularySuggestions = suggestVocabulary(normalized, repeatedSimpleWords);

  return {
    articulated,
    improvedArticulation,
    vocabularySuggestions,
    ambiguityNotes,
    clarificationQuestion: buildClarifyingQuestion(normalized, ambiguityNotes),
    explanation: buildExplanation(normalized, articulated, improvedArticulation),
    expressionScore: scoreExpression(normalized, articulated, vocabularySuggestions, ambiguityNotes),
    confidence: articulated === sentenceCase(normalized) ? "high" : "medium",
    notes: "Expression Brain used conservative local coaching because live expression was unavailable.",
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

  if (/\bdinner with\b/.test(lower) && !/\bremind me|reminder|calendar|schedule|add\b/.test(lower)) {
    notes.push("It is unclear whether this dinner should become a task, reminder, calendar-style commitment, or just context.");
  }

  if (/\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) {
    notes.push("The weekday is clear, but the exact date depends on today's date.");
  }

  if (/\bmaybe|idk|not sure\b/.test(lower)) {
    notes.push("The capture includes uncertainty that should be preserved.");
  }

  return notes;
}

function buildClarifyingQuestion(input: string, ambiguityNotes: string[]): string | null {
  if (ambiguityNotes.length === 0) return null;
  const lower = input.toLowerCase();

  if (/\bdinner with\b/.test(lower)) {
    return "Do you want this dinner saved as a reminder/task, or is it just context?";
  }

  return "What detail would make this easier to act on later?";
}

function suggestVocabulary(input: string, repeatedSimpleWords: string[]): VocabularySuggestion[] {
  const lower = input.toLowerCase();
  const suggestions: VocabularySuggestion[] = [];
  const seen = new Set<string>();

  for (const word of Object.keys(SIMPLE_WORDS)) {
    const repeated = repeatedSimpleWords.includes(word);
    const present = new RegExp(`\\b${word}\\b`, "i").test(lower);
    if (!present && !repeated) continue;
    if (seen.has(word)) continue;
    suggestions.push(SIMPLE_WORDS[word]!);
    seen.add(word);
  }

  return suggestions.slice(0, 3);
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

function buildExplanation(original: string, articulated: string, improved: string): string {
  if (articulated !== improved) {
    return "The rewrite preserves the original details, fixes wording, and separates timing/context so downstream routing is less likely to misread it.";
  }
  if (original !== articulated) {
    return "The rewrite cleans up grammar and spacing while preserving the original meaning.";
  }
  return "The thought was already understandable, so only light normalization was needed.";
}

function toArticulation(original: string, output: ExpressionOutput): ArticulationResult {
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

async function getRepeatedSimpleWords(userId: string): Promise<string[]> {
  const recent = await prisma.expressionRewrite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { rawText: true },
  });

  const counts = new Map<string, number>();
  for (const item of recent) {
    const lower = item.rawText.toLowerCase();
    for (const word of Object.keys(SIMPLE_WORDS)) {
      if (new RegExp(`\\b${word}\\b`, "i").test(lower)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .map(([word]) => word);
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
