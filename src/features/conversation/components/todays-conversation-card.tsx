"use client";

import { useState, useTransition } from "react";
import { Brain, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitConversationAnswer } from "../actions/conversation.actions";

export interface TodayConversationCardData {
  id: string;
  mode: string;
  slot: string;
  prompt: string;
  contextNote: string | null;
}

export function TodaysConversationCard({
  conversation,
  totalXp,
  streak,
}: {
  conversation: TodayConversationCardData | null;
  totalXp: number;
  streak: number;
}) {
  const [activeConversation, setActiveConversation] = useState(conversation);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!activeConversation && completed) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/30">
        <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4" />
          Conversation saved
        </div>
        {feedback && <p className="mt-3 text-sm leading-6 text-green-800 dark:text-green-200">{feedback}</p>}
        <ConversationStats totalXp={totalXp} streak={streak} />
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          <Brain className="h-4 w-4" />
          Today&apos;s Conversation
        </div>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          You already hit today&apos;s companion limit. Maximum 3 conversations per day.
        </p>
        <ConversationStats totalXp={totalXp} streak={streak} />
      </div>
    );
  }

  function handleSubmit() {
    if (!activeConversation) return;
    setError(null);
    startTransition(async () => {
      const result = await submitConversationAnswer({
        conversationId: activeConversation.id,
        answer,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setFeedback(`${result.data.feedback} +${result.data.xpAmount} ${formatCategory(result.data.xpCategory)} XP.`);
      if (result.data.followUpQuestion && result.data.followUpConversationId) {
        setActiveConversation({
          ...activeConversation,
          id: result.data.followUpConversationId,
          prompt: result.data.followUpQuestion,
          contextNote: "Follow-up question based on your answer.",
        });
      } else {
        setActiveConversation(null);
        setCompleted(true);
      }
      setAnswer("");
    });
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
            <Sparkles className="h-4 w-4" />
            Today&apos;s Conversation
          </div>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-blue-600/70 dark:text-blue-300/70">
            {formatCategory(activeConversation.mode)} · {formatCategory(activeConversation.slot)}
          </p>
        </div>
        <ConversationStats totalXp={totalXp} streak={streak} />
      </div>

      {activeConversation.contextNote && (
        <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs leading-5 text-blue-900/70 dark:bg-neutral-950/40 dark:text-blue-100/70">
          {activeConversation.contextNote}
        </p>
      )}

      <p className="mt-4 text-xl font-semibold leading-8 text-blue-950 dark:text-blue-50">
        {activeConversation.prompt}
      </p>

      {feedback && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-300" />
          <p className="text-sm leading-6 text-green-800 dark:text-green-200">{feedback}</p>
        </div>
      )}

      <div className="mt-4 space-y-3">
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Answer naturally. One honest sentence is enough."
          rows={3}
          className="w-full resize-none rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-blue-400 dark:border-blue-900 dark:bg-neutral-950 dark:text-neutral-50"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button onClick={handleSubmit} disabled={isPending || answer.trim().length < 2} className="w-full justify-center">
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            "Answer"
          )}
        </Button>
      </div>
    </div>
  );
}

function ConversationStats({ totalXp, streak }: { totalXp: number; streak: number }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="rounded-full bg-white/80 px-2 py-1 font-medium text-blue-800 dark:bg-neutral-950/50 dark:text-blue-100">
        {totalXp} XP
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 font-medium text-blue-800 dark:bg-neutral-950/50 dark:text-blue-100">
        {streak} day streak
      </span>
    </div>
  );
}

function formatCategory(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}
