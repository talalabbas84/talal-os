import { PromptPlayground } from "./prompt-playground";

export const metadata = {
  title: "Prompt Playground — Talal OS",
};

export default function PromptsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Prompt Playground
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Compose and test Talal OS brain prompts without writing to the database.
        </p>
      </div>

      <PromptPlayground />
    </div>
  );
}
