"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteThought, updateThoughtImportance } from "@/features/thoughts/actions/thought.actions";
import { cn } from "@/utils/cn";
import type { MemoryImportance, Thought, ThoughtCategory } from "@prisma/client";

const categories: Array<ThoughtCategory | "ALL"> = [
  "ALL",
  "SELF_INSIGHT",
  "IDEA",
  "FEAR",
  "GOAL",
  "OBSERVATION",
  "RELATIONSHIP",
  "BUSINESS",
  "HEALTH",
  "LEARNING",
  "RANDOM",
];

const importanceOrder: MemoryImportance[] = ["LOW", "MEDIUM", "HIGH", "PERMANENT"];

export function ThoughtVaultView({ thoughts }: { thoughts: Thought[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ThoughtCategory | "ALL">("ALL");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return thoughts.filter((thought) => {
      const matchesCategory = category === "ALL" || thought.category === category;
      const matchesQuery =
        !q ||
        thought.rawText.toLowerCase().includes(q) ||
        thought.cleanedText.toLowerCase().includes(q) ||
        thought.summary.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [thoughts, query, category]);

  function cycleImportance(thought: Thought) {
    const index = importanceOrder.indexOf(thought.importance);
    const next = importanceOrder[Math.min(index + 1, importanceOrder.length - 1)] ?? "HIGH";
    setPendingId(thought.id);
    startTransition(async () => {
      await updateThoughtImportance(thought.id, next);
      setPendingId(null);
    });
  }

  function removeThought(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await deleteThought(id);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Thought Vault
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Raw thoughts stay intact. Talal OS keeps the cleaned version and summary beside them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search raw thoughts, cleaned text, or summaries…"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={(value) => setCategory(value as ThoughtCategory | "ALL")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((item) => (
              <SelectItem key={item} value={item}>
                {formatLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
          No thoughts match this view.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((thought) => (
            <article
              key={thought.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={thought.category === "SELF_INSIGHT" ? "info" : "secondary"}>
                  {formatLabel(thought.category)}
                </Badge>
                <Badge variant={thought.importance === "HIGH" || thought.importance === "PERMANENT" ? "warning" : "outline"}>
                  {thought.importance.toLowerCase()}
                </Badge>
                {thought.emotionalTone && (
                  <span className="text-xs text-neutral-400">{thought.emotionalTone}</span>
                )}
                <span className="ml-auto text-xs text-neutral-400">
                  {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(thought.createdAt)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <ThoughtBlock label="Original" text={thought.rawText} muted />
                <ThoughtBlock label="AI understood" text={thought.cleanedText} />
              </div>

              <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm leading-6 text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                {thought.summary}
              </p>

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cycleImportance(thought)}
                  disabled={pendingId === thought.id || thought.importance === "PERMANENT"}
                >
                  <Star className={cn("h-3.5 w-3.5", thought.importance !== "LOW" && "fill-current")} />
                  Mark important
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeThought(thought.id)}
                  disabled={pendingId === thought.id}
                  className="text-red-500 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ThoughtBlock({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className={cn("mt-2 text-sm leading-6", muted ? "text-neutral-500" : "text-neutral-800 dark:text-neutral-200")}>
        {text}
      </p>
    </div>
  );
}

function formatLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}
