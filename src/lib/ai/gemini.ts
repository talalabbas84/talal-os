import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  captureResultSchema,
  intentResultSchema,
  recommendationSchema,
  reflectionResultSchema,
  type CaptureResult,
  type IntentResultOutput,
  type RecommendationOutput,
  type ReflectionResultOutput,
} from "./schema";
import {
  buildSystemPrompt,
  buildRepairPrompt,
  buildIntentPrompt,
  buildRecommendationPrompt,
  buildReflectionPrompt,
  buildQuestionPrompt,
} from "./prompts";
import type { AIProvider } from "./types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return new GoogleGenerativeAI(key);
}

function stripMarkdown(text: string): string {
  // Remove ```json ... ``` or ``` ... ``` wrappers the model sometimes adds
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  return text.trim();
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function callModel(
  client: GoogleGenerativeAI,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      // Ask for JSON so the model is less likely to wrap in markdown
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}


function parseWith<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; data: T } | { ok: false; error: string; raw: string } {
  const cleaned = stripMarkdown(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSON.parse failed: ${String(e)}`, raw: cleaned };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.issues.map((i) => `${String(i.path.join("."))}: ${i.message}`).join("; "),
    raw: cleaned,
  };
}

async function callWithRetry<T>(
  client: GoogleGenerativeAI,
  systemPrompt: string,
  userMessage: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw1 = await callModel(client, systemPrompt, userMessage);
  const a1 = parseWith(raw1, schema);
  if (a1.ok) return a1.data;

  const raw2 = await callModel(client, systemPrompt, buildRepairPrompt(a1.error, a1.raw));
  const a2 = parseWith(raw2, schema);
  if (a2.ok) return a2.data;

  throw new Error(`Gemini validation failed after retry. Last error: ${a2.error}`);
}

export const geminiProvider: AIProvider = {
  async organizeCapture(input: string, contextPrompt?: string): Promise<CaptureResult> {
    const client = getClient();
    return callWithRetry(client, buildSystemPrompt(todayISO(), contextPrompt), input, captureResultSchema);
  },

  async classifyIntent(text: string, contextSummary?: string): Promise<IntentResultOutput> {
    const client = getClient();
    return callWithRetry(client, buildIntentPrompt(contextSummary), text, intentResultSchema);
  },

  async generateRecommendation(text: string, contextPrompt: string): Promise<RecommendationOutput> {
    const client = getClient();
    return callWithRetry(client, buildRecommendationPrompt(contextPrompt), text, recommendationSchema);
  },

  async generateReflection(text: string): Promise<ReflectionResultOutput> {
    const client = getClient();
    return callWithRetry(client, buildReflectionPrompt(), text, reflectionResultSchema);
  },

  async answerQuestion(text: string, contextPrompt: string): Promise<string> {
    const client = getClient();
    const systemPrompt = buildQuestionPrompt(contextPrompt);
    const raw = await callModel(client, systemPrompt, text);
    return stripMarkdown(raw) || "I couldn't find a clear answer based on your context.";
  },
};
