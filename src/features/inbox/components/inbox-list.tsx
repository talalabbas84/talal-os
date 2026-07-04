"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Archive, Check } from "lucide-react";
import {
  deleteInboxEntry,
  updateInboxStatus,
} from "@/features/inbox/actions/inbox.actions";
import { InboxEntryDialog } from "./inbox-entry-dialog";
import { Button } from "@/components/ui/button";
import { formatDateShort } from "@/utils/date";
import type { InboxEntry, InboxStatus } from "@/types";

const tabs: { label: string; value: InboxStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Processed", value: "PROCESSED" },
  { label: "Archived", value: "ARCHIVED" },
];

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

function EntryRow({ entry }: { entry: InboxEntry }) {
  const [, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  function handleStatus(status: InboxStatus) {
    startTransition(async () => {
      await updateInboxStatus(entry.id, status);
    });
  }

  function handleDelete() {
    setDeleted(true);
    startTransition(async () => {
      await deleteInboxEntry(entry.id);
    });
  }

  return (
    <div className="group flex items-start gap-4 rounded-lg border border-neutral-100 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
          {entry.title}
        </p>
        {entry.description && (
          <p className="text-sm text-neutral-500 line-clamp-2">
            {entry.description}
          </p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {entry.category && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[entry.category] ?? "bg-neutral-100 text-neutral-700"}`}
            >
              {entry.category.charAt(0) + entry.category.slice(1).toLowerCase()}
            </span>
          )}
          <span className="text-xs text-neutral-400">
            {formatDateShort(entry.createdAt)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {entry.status === "PENDING" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Mark processed"
            onClick={() => handleStatus("PROCESSED")}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        {entry.status !== "ARCHIVED" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Archive"
            onClick={() => handleStatus("ARCHIVED")}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
        <InboxEntryDialog
          entry={entry}
          trigger={
            <Button size="icon" variant="ghost" className="h-7 w-7">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-400 hover:text-red-600"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function InboxList({ entries }: { entries: InboxEntry[] }) {
  const [activeTab, setActiveTab] = useState<InboxStatus>("PENDING");

  const filtered = entries.filter((e) => e.status === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value as InboxStatus)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs text-neutral-400">
              {entries.filter((e) => e.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          Nothing here
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
