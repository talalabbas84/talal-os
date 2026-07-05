import { GoogleGenerativeAI } from "@google/generative-ai";
import { captureResultSchema, type CaptureResult } from "./schema";
import { buildSystemPrompt, buildRepairPrompt } from "./prompts";
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

function parseAndValidate(
  raw: string,
): { ok: true; data: CaptureResult } | { ok: false; error: string; raw: string } {
  const cleaned = stripMarkdown(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `JSON.parse failed: ${String(e)}`, raw: cleaned };
  }

  const result = captureResultSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    raw: cleaned,
  };
}

export const geminiProvider: AIProvider = {
  async organizeCapture(input: string, contextPrompt?: string): Promise<CaptureResult> {
    const client = getClient();
    const systemPrompt = buildSystemPrompt(todayISO(), contextPrompt);

    // First attempt
    const raw1 = await callModel(client, systemPrompt, input);
    const attempt1 = parseAndValidate(raw1);
    if (attempt1.ok) return attempt1.data;

    // Retry with a repair prompt — model already has context from the chat history
    // We create a fresh call with the repair prompt as the user message so
    // the model sees what went wrong and can fix it.
    const repairMessage = buildRepairPrompt(attempt1.error, attempt1.raw);
    const raw2 = await callModel(client, systemPrompt, repairMessage);
    const attempt2 = parseAndValidate(raw2);
    if (attempt2.ok) return attempt2.data;

    throw new Error(
      `Gemini response failed validation after retry. Last error: ${attempt2.error}`,
    );
  },
};
