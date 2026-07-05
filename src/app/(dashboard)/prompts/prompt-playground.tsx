"use client";

import { useMemo, useState, useTransition } from "react";
import { testPrompt } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { brainOptions, type BrainName, type PromptPlaygroundResult } from "@/lib/prompts";

const sampleContext = `Current State: focused but context-switching.
Projects: Talal OS v1.3 prompt management.
Today's Tasks: ship prompt builder, verify TypeScript, deploy to Vercel.
Memory: Talal prefers one clear next step and concise guidance.`;

export function PromptPlayground() {
  const [brain, setBrain] = useState<BrainName>("decision");
  const [context, setContext] = useState(sampleContext);
  const [userInput, setUserInput] = useState("I have too many things competing for attention. What should I do next?");
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<PromptPlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedBrain = useMemo(
    () => brainOptions.find((option) => option.brain === brain),
    [brain],
  );

  function runTest() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await testPrompt({ brain, userInput, context, live });
        setResult(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Prompt test failed.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="space-y-1">
          <label htmlFor="brain" className="text-sm font-medium">
            Brain
          </label>
          <select
            id="brain"
            value={brain}
            onChange={(event) => setBrain(event.target.value as BrainName)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            {brainOptions.map((option) => (
              <option key={option.brain} value={option.brain}>
                {option.name} v{option.version}
              </option>
            ))}
          </select>
          {selectedBrain && (
            <p className="text-xs text-neutral-500">
              {selectedBrain.description} Tone: {selectedBrain.tone}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="context" className="text-sm font-medium">
            Context
          </label>
          <Textarea
            id="context"
            value={context}
            onChange={(event) => setContext(event.target.value)}
            rows={8}
            className="min-h-48"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="userInput" className="text-sm font-medium">
            User Input
          </label>
          <Textarea
            id="userInput"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            rows={5}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <input
            type="checkbox"
            checked={live}
            onChange={(event) => setLive(event.target.checked)}
          />
          Run live LLM if enabled
        </label>

        <Button onClick={runTest} disabled={isPending} className="w-full">
          {isPending ? "Testing…" : "Build Prompt"}
        </Button>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Token Count</h2>
            <span className="text-sm text-neutral-500">
              {result ? result.tokenCount : "—"}
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            Approximate count for system + user prompt. Testing performs no database writes.
          </p>
        </div>

        <PromptPanel title="Final System Prompt" value={result?.systemPrompt} />
        <PromptPanel title="Final User Prompt" value={result?.userPrompt} />
        <PromptPanel title="LLM Response" value={result?.llmResponse} />
      </section>
    </div>
  );
}

function PromptPanel({ title, value }: { title: string; value?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-3 font-medium">{title}</h2>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
        {value ?? "Run a prompt test to view output."}
      </pre>
    </div>
  );
}
