"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildPrompt, estimateTokenCount, type BrainName } from "@/lib/prompts";

interface PlaygroundInput {
  brain: BrainName;
  userInput: string;
  context: string;
  live?: boolean;
}

export async function testPrompt(input: PlaygroundInput) {
  const prompt = buildPrompt({
    brain: input.brain,
    userInput: input.userInput,
    context: input.context,
  });

  const tokenCount = estimateTokenCount(`${prompt.systemPrompt}\n\n${prompt.userPrompt}`);
  const canRunLive =
    input.live &&
    process.env.PROMPT_PLAYGROUND_LIVE === "true" &&
    Boolean(process.env.GEMINI_API_KEY);

  if (!canRunLive) {
    return {
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      tokenCount,
      llmResponse:
        "Preview mode: prompt composed successfully. Set PROMPT_PLAYGROUND_LIVE=true and GEMINI_API_KEY in the environment to run a live LLM test. No database writes were performed.",
    };
  }

  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = client.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    systemInstruction: prompt.systemPrompt,
  });
  const result = await model.generateContent(prompt.userPrompt);

  return {
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    tokenCount,
    llmResponse: result.response.text(),
  };
}
