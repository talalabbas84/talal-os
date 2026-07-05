"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAnswer } from "@/features/learn/actions/learn.actions";
import { buildReviewPrompt } from "@/features/learn/lib/review";
import type { LearningItem, ReviewSelfRating } from "@prisma/client";

export function ReviewFlow({ items }: { items: LearningItem[] }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const item = items[index];
  const prompt = useMemo(() => item ? buildReviewPrompt(item) : "", [item]);

  if (!item) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
        <h1 className="mt-4 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Review complete</h1>
        <p className="mt-2 text-sm text-neutral-500">No more due items right now.</p>
        <Button asChild className="mt-5">
          <Link href="/learn">Back to Learn</Link>
        </Button>
      </div>
    );
  }

  function rate(selfRating: ReviewSelfRating) {
    if (!item) return;
    setError(null);
    startTransition(async () => {
      const result = await submitReviewAnswer({
        learningItemId: item.id,
        prompt,
        answer,
        selfRating,
      });
      if (result.success) {
        setAnswer("");
        setRevealed(false);
        setIndex((value) => value + 1);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <p className="text-sm text-neutral-400">Item {index + 1} of {items.length}</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Review</h1>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Prompt</p>
        <p className="mt-2 text-lg font-medium leading-7 text-neutral-900 dark:text-neutral-50">{prompt}</p>

        <Textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Answer from memory…"
          rows={4}
          className="mt-4"
        />

        {!revealed ? (
          <Button className="mt-4 w-full" onClick={() => setRevealed(true)}>
            Show answer
          </Button>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-950">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Expected answer</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{item.content}</p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["AGAIN", "HARD", "GOOD", "EASY"] as ReviewSelfRating[]).map((rating) => (
                <Button
                  key={rating}
                  variant={rating === "AGAIN" ? "destructive" : rating === "EASY" ? "default" : "outline"}
                  onClick={() => rate(rating)}
                  disabled={isPending}
                >
                  {rating}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
