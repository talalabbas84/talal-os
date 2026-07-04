"use client";

import { useState, useTransition } from "react";
import { upsertDailyLog } from "@/features/daily-log/actions/daily-log.actions";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { DailyLog } from "@/types";

const prompts = [
  { name: "feeling", label: "How do I feel today?", placeholder: "Be honest with yourself…" },
  { name: "accomplished", label: "What did I accomplish?", placeholder: "Big and small wins count…" },
  { name: "distracted", label: "What distracted me?", placeholder: "What pulled me off track?" },
  { name: "improve", label: "What should I improve tomorrow?", placeholder: "One thing to focus on…" },
] as const;

interface Props {
  date: string;
  log: DailyLog | null;
}

export function DailyLogForm({ date, log }: Props) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const data = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await upsertDailyLog({
        date,
        feeling: (data.get("feeling") as string) || undefined,
        accomplished: (data.get("accomplished") as string) || undefined,
        distracted: (data.get("distracted") as string) || undefined,
        improve: (data.get("improve") as string) || undefined,
      });

      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {prompts.map(({ name, label, placeholder }) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={name} className="text-base font-medium">
            {label}
          </Label>
          <Textarea
            id={name}
            name={name}
            defaultValue={(log?.[name] as string) ?? ""}
            placeholder={placeholder}
            rows={4}
            className="resize-none"
          />
        </div>
      ))}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && (
        <p className="text-sm text-emerald-600">Saved.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : log ? "Update" : "Save Log"}
        </Button>
      </div>
    </form>
  );
}
