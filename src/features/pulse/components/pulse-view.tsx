"use client";

import { useState, useTransition } from "react";
import { Activity, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateTodayPulses,
  skipPulse,
  submitPulseCapture,
} from "@/features/pulse/actions/pulse.actions";
import type { ActivityLog, DayPulse } from "@prisma/client";

export function PulseView({
  pendingPulse,
  recentActivities,
}: {
  pendingPulse: DayPulse | null;
  recentActivities: ActivityLog[];
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await submitPulseCapture({
        pulseId: pendingPulse?.id,
        text,
      });
      if (result.success) {
        setText("");
        setMessage("Check-in saved.");
      } else {
        setError(result.error);
      }
    });
  }

  function generate() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await generateTodayPulses();
      if (result.success) {
        setMessage(result.data === 0 ? "Today's pulses already exist." : `Generated ${result.data} pulse${result.data !== 1 ? "s" : ""}.`);
      } else {
        setError(result.error);
      }
    });
  }

  function skip() {
    if (!pendingPulse) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await skipPulse(pendingPulse.id);
      if (result.success) setMessage("Pulse skipped.");
      else setError(result.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Day Pulse
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Quick check-ins build a timeline of the day without manual admin.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          <Sparkles className="h-4 w-4" />
          {pendingPulse?.prompt ?? "What are you doing right now?"}
        </div>

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="working on Talal OS, feeling tired, need groceries later…"
          rows={5}
          className="mt-4"
        />

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={submit} disabled={isPending || text.trim().length < 3}>
            {isPending ? "Saving…" : "Save check-in"}
          </Button>
          {pendingPulse && (
            <Button variant="outline" onClick={skip} disabled={isPending}>
              Skip
            </Button>
          )}
          <Button variant="ghost" onClick={generate} disabled={isPending}>
            Generate Today&apos;s Pulses
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-neutral-500">
          <Activity className="h-4 w-4" />
          Recent Activity
        </div>

        {recentActivities.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">No activity logs today.</p>
        ) : (
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{activity.activity}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatCategory(activity.category)}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
                    <Clock className="h-3 w-3" />
                    {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(activity.createdAt)}
                  </span>
                </div>
                {activity.notes && <p className="mt-2 text-xs leading-5 text-neutral-500">{activity.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function formatCategory(category: string): string {
  return category.toLowerCase().replace(/_/g, " ");
}
