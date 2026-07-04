import Link from "next/link";
import { ArrowRight, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/utils/date";
import type { InboxEntry } from "@/types";

const categoryColors: Record<string, string> = {
  IDEA: "bg-violet-100 text-violet-700",
  TASK: "bg-blue-100 text-blue-700",
  PROJECT: "bg-amber-100 text-amber-700",
  GOAL: "bg-emerald-100 text-emerald-700",
  JOURNAL: "bg-pink-100 text-pink-700",
  LEARNING: "bg-cyan-100 text-cyan-700",
  FINANCE: "bg-green-100 text-green-700",
  HEALTH: "bg-red-100 text-red-700",
  DANCE: "bg-purple-100 text-purple-700",
  BUSINESS: "bg-orange-100 text-orange-700",
  PERSONAL: "bg-neutral-100 text-neutral-700",
};

export function DashboardInboxList({ entries }: { entries: InboxEntry[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">
          Recent Inbox
        </CardTitle>
        <Link
          href="/inbox"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
        >
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            Inbox is clear
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 rounded-md p-2"
            >
              <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{entry.title}</p>
                <p className="text-xs text-neutral-400">
                  {formatDateShort(entry.createdAt)}
                </p>
              </div>
              {entry.category && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[entry.category] ?? "bg-neutral-100 text-neutral-700"}`}
                >
                  {entry.category.charAt(0) + entry.category.slice(1).toLowerCase()}
                </span>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
