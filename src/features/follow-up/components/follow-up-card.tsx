"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCircle, ChevronRight } from "lucide-react";
import { answerFollowUpItem, dismissFollowUpItem } from "../actions/queue.actions";
import { cn } from "@/utils/cn";

type FollowUpItem = {
  id: string;
  type: string;
  priority: number;
  question: string;
  reason: string | null;
  entityType: string | null;
  entityLabel: string | null;
};

const TYPE_ICONS: Record<string, string> = {
  CLARIFICATION: "❓",
  PREPARATION: "📋",
  REFLECTION: "💭",
  TASK_CHECK: "✅",
  RELATIONSHIP: "👥",
  REMINDER: "⏰",
  LEARNING: "📚",
};

export function FollowUpCard({ item }: { item: FollowUpItem }) {
  const router = useRouter();
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [isDismissing, startDismiss] = useTransition();
  const [isAnswering, startAnswer] = useTransition();

  const icon = TYPE_ICONS[item.type] ?? "💡";

  function handleDismiss() {
    startDismiss(async () => {
      await dismissFollowUpItem(item.id);
      router.refresh();
    });
  }

  function handleAnswer() {
    const trimmed = answerText.trim();
    if (!trimmed) {
      // Redirect to capture with context pre-filled
      router.push(`/capture?text=${encodeURIComponent(`${item.question}\n\n`)}`);
      return;
    }
    startAnswer(async () => {
      await answerFollowUpItem(item.id, trimmed);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-base">{icon}</span>
        <div className="min-w-0 flex-1">
          {item.entityLabel && (
            <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {item.entityLabel}
            </p>
          )}
          <p className="text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-50">
            {item.question}
          </p>
          {item.reason && (
            <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{item.reason}</p>
          )}

          {showAnswer ? (
            <div className="mt-3 space-y-2">
              <textarea
                autoFocus
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer, or leave blank to open Capture…"
                rows={2}
                className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:focus:border-neutral-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAnswer}
                  disabled={isAnswering}
                  className={cn(
                    "flex items-center gap-1 rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700",
                    "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
                    "disabled:opacity-40",
                  )}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {answerText.trim() ? "Save" : "Open Capture"}
                </button>
                <button
                  onClick={() => setShowAnswer(false)}
                  className="rounded-xl border border-neutral-200 px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={() => setShowAnswer(true)}
                className="flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                Answer <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleDismiss}
          disabled={isDismissing}
          className="shrink-0 rounded-lg p-1 text-neutral-300 transition-colors hover:text-neutral-500 disabled:opacity-40 dark:text-neutral-600 dark:hover:text-neutral-400"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
