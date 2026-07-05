"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateTodayPlan } from "@/features/dashboard/actions/morning-plan.actions";

export function GenerateTodayButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      onClick={() => startTransition(async () => { await generateTodayPlan(); })}
      disabled={isPending}
      className="gap-2"
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {isPending ? "Generating…" : "Generate Today"}
    </Button>
  );
}
