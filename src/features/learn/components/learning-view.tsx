"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BookOpen, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLearningItem } from "@/features/learn/actions/learn.actions";
import type { LearningCategory, LearningItem } from "@prisma/client";

const categories: LearningCategory[] = [
  "VOCABULARY",
  "DANCE",
  "PUBLIC_SPEAKING",
  "ACCENT",
  "SOFTWARE",
  "FINANCE",
  "FITNESS",
  "BOOK",
  "BUSINESS",
  "OTHER",
];

export function LearningView({
  dueItems,
  allItems,
}: {
  dueItems: LearningItem[];
  allItems: LearningItem[];
}) {
  const [category, setCategory] = useState<LearningCategory>("VOCABULARY");
  const [difficulty, setDifficulty] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      const result = await createLearningItem({
        title: data.get("title"),
        content: data.get("content"),
        category,
        difficulty,
      });
      if (result.success) {
        form.reset();
        setCategory("VOCABULARY");
        setDifficulty("MEDIUM");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Learning Retention
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Talal learns. Talal OS schedules review.
          </p>
        </div>
        <Button asChild disabled={dueItems.length === 0}>
          <Link href="/learn/review">
            <Sparkles className="h-4 w-4" />
            Start Review
          </Link>
        </Button>
      </div>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">Due Reviews</h2>
          <Badge variant={dueItems.length > 0 ? "warning" : "secondary"}>{dueItems.length}</Badge>
        </div>
        {dueItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">No reviews due right now.</p>
        ) : (
          <div className="space-y-2">
            {dueItems.map((item) => (
              <LearningRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-500">Add manually</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input name="title" placeholder="Serendipity" required />
          <Textarea name="content" placeholder="A fortunate discovery by chance." rows={3} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={category} onValueChange={(value) => setCategory(value as LearningCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>{formatLabel(item)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={(value) => setDifficulty(value as "LOW" | "MEDIUM" | "HIGH")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low difficulty</SelectItem>
                <SelectItem value="MEDIUM">Medium difficulty</SelectItem>
                <SelectItem value="HIGH">High difficulty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" disabled={isPending}>{isPending ? "Adding…" : "Add learning item"}</Button>
        </form>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-neutral-400" />
          <h2 className="text-sm font-medium text-neutral-500">All Learning Items</h2>
        </div>
        {allItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">
            Capture something you learned. It will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {allItems.map((item) => (
              <LearningRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LearningRow({ item }: { item: LearningItem }) {
  return (
    <div className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.title}</p>
        <Badge variant="secondary">{formatLabel(item.category)}</Badge>
        <Badge variant={item.masteryLevel === "MASTERED" ? "success" : "outline"}>{formatLabel(item.masteryLevel)}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{item.content}</p>
      <p className="mt-2 text-xs text-neutral-400">
        Reviewed {item.reviewCount} time{item.reviewCount !== 1 ? "s" : ""}
        {item.nextReviewAt ? ` · Next ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(item.nextReviewAt)}` : ""}
      </p>
    </div>
  );
}

function formatLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}
