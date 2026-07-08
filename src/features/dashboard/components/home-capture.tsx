"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, FileText, Loader2 } from "lucide-react";
import { saveDraft } from "@/features/capture/actions/draft.actions";
import { cn } from "@/utils/cn";

const MODE_PLACEHOLDERS: Record<string, string> = {
  focus: "Capture distracting thoughts here — keep them out of your head.",
  preparation: "Any last thoughts before you go?",
  reflection: "How did today go? What's on your mind?",
  recovery: "How are you feeling? What do you need?",
  morning: "What do you want to accomplish today?",
};

export function HomeCapture({ mode }: { mode?: string }) {
  const placeholder = (mode && MODE_PLACEHOLDERS[mode]) ?? "What's on your mind?";
  const router = useRouter();
  const [text, setText] = useState("");
  const [isSaving, startSaving] = useTransition();

  function handleOrganize() {
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push(`/capture?text=${encodeURIComponent(trimmed)}`);
  }

  function handleSaveDraft() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startSaving(async () => {
      await saveDraft(trimmed);
      setText("");
    });
  }

  const hasText = text.trim().length >= 3;

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && hasText) handleOrganize();
        }}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3.5 text-base leading-relaxed text-neutral-900 placeholder-neutral-300 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50 dark:placeholder-neutral-600 dark:focus:border-neutral-500"
      />
      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Talk naturally. Messy thoughts are expected. ⌘↵ to organize.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={handleOrganize}
          disabled={!hasText}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
            "bg-neutral-900 text-white hover:bg-neutral-700",
            "dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Sparkles className="h-4 w-4" />
          Organize
        </button>

        {hasText && (
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-50",
              "dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-900",
              "disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Save Draft
          </button>
        )}
      </div>
    </div>
  );
}
