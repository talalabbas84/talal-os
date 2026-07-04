"use client";

import { useState, useTransition, useMemo } from "react";
import { Brain, Plus, Search, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { createMemoryEntry, deleteMemoryEntry } from "../actions/memory.actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import { MEMORY_TYPES, MEMORY_IMPORTANCES } from "@/lib/ai/schema";
import type { MemoryEntry, MemoryType, MemoryImportance } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { label: string; value: "ALL" | MemoryType }[] = [
  { label: "All", value: "ALL" },
  { label: "Identity", value: "IDENTITY" },
  { label: "Life Principles", value: "LIFE_PRINCIPLE" },
  { label: "Product Decisions", value: "PRODUCT_DECISION" },
  { label: "Lessons Learned", value: "LESSON_LEARNED" },
  { label: "Current State", value: "CURRENT_STATE" },
  { label: "Product Context", value: "PRODUCT_CONTEXT" },
];

export const TYPE_LABELS: Record<MemoryType, string> = {
  IDENTITY: "Identity",
  LIFE_PRINCIPLE: "Life Principle",
  PRODUCT_DECISION: "Product Decision",
  PRODUCT_CONTEXT: "Product Context",
  LESSON_LEARNED: "Lesson Learned",
  CURRENT_STATE: "Current State",
  RELATIONSHIP_INSIGHT: "Relationship",
  HEALTH_INSIGHT: "Health",
  FINANCE_INSIGHT: "Finance",
  BUSINESS_IDEA: "Business Idea",
  PERSONAL_PATTERN: "Pattern",
};

export const IMPORTANCE_STYLES: Record<MemoryImportance, string> = {
  PERMANENT: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  HIGH: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  LOW: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const IMPORTANCE_ORDER: Record<MemoryImportance, number> = {
  PERMANENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
};

// ── Root view ─────────────────────────────────────────────────────────────────

export function MemoryView({ memories: initialMemories }: { memories: MemoryEntry[] }) {
  const [memories, setMemories] = useState(initialMemories);
  const [activeTab, setActiveTab] = useState<"ALL" | MemoryType>("ALL");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  function onMemoryAdded(entry: MemoryEntry) {
    setMemories((prev) => [entry, ...prev]);
    setShowAddForm(false);
  }

  function onMemoryDeleted(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  const filtered = useMemo(() => {
    let result = memories;
    if (activeTab !== "ALL") {
      result = result.filter((m) => m.type === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.content.toLowerCase().includes(q),
      );
    }
    return [...result].sort(
      (a, b) =>
        IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [memories, activeTab, search]);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.value
                ? "bg-neutral-900 text-white dark:bg-neutral-50 dark:text-neutral-900"
                : "border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Add */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories…"
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500 dark:focus:border-neutral-500"
          />
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            showAddForm
              ? "border border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              : "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200",
          )}
        >
          {showAddForm ? (
            <><X className="h-4 w-4" /> Cancel</>
          ) : (
            <><Plus className="h-4 w-4" /> Add Memory</>
          )}
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <MemoryAddForm
          onAdded={onMemoryAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Memory count */}
      {!showAddForm && memories.length > 0 && (
        <p className="text-xs text-neutral-400">
          {filtered.length === memories.length
            ? `${memories.length} memor${memories.length !== 1 ? "ies" : "y"}`
            : `${filtered.length} of ${memories.length} shown`}
        </p>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-14 text-center dark:border-neutral-700">
          <Brain className="mx-auto mb-3 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
          <p className="text-sm text-neutral-400">
            {search || activeTab !== "ALL"
              ? "No memories match your filter."
              : "No memories yet. Capture something meaningful to get started."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} onDeleted={onMemoryDeleted} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────

function MemoryAddForm({
  onAdded,
  onCancel,
}: {
  onAdded: (entry: MemoryEntry) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryType>("LIFE_PRINCIPLE");
  const [importance, setImportance] = useState<MemoryImportance>("MEDIUM");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createMemoryEntry({
        title: title.trim(),
        content: content.trim(),
        type,
        importance,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      onAdded(res.data);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
        New Memory
      </h3>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short title for this memory"
          className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write the full memory here…"
          rows={3}
          className="w-full resize-none rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder-neutral-400 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-50 dark:placeholder-neutral-500"
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MemoryType)}
            className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {MEMORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            value={importance}
            onChange={(e) => setImportance(e.target.value as MemoryImportance)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {MEMORY_IMPORTANCES.map((i) => (
              <option key={i} value={i}>
                {i.charAt(0) + i.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isPending ? "Saving…" : "Save Memory"}
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Memory card ───────────────────────────────────────────────────────────────

function MemoryCard({
  memory,
  onDeleted,
}: {
  memory: MemoryEntry;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  const isLong = memory.content.length > 160;

  function handleDelete() {
    startDelete(async () => {
      await deleteMemoryEntry(memory.id);
      onDeleted(memory.id);
    });
  }

  return (
    <Card className="flex flex-col border-neutral-200 dark:border-neutral-800">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                IMPORTANCE_STYLES[memory.importance],
              )}
            >
              {memory.importance}
            </span>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {TYPE_LABELS[memory.type]}
            </span>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="shrink-0 text-neutral-300 transition-colors hover:text-red-400 disabled:opacity-40"
            aria-label="Delete memory"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-sm font-medium text-neutral-900 dark:text-neutral-50">
          {memory.title}
        </p>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col pt-0">
        <p
          className={cn(
            "text-sm leading-relaxed text-neutral-600 dark:text-neutral-400",
            !expanded && isLong && "line-clamp-3",
          )}
        >
          {memory.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" />Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3" />Show more</>
            )}
          </button>
        )}

        <div className="mt-auto flex items-center gap-2 pt-4 text-[10px] text-neutral-400">
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-800">
            {formatSource(memory.source)}
          </span>
          <span>{formatRelativeDate(memory.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSource(source: string): string {
  const map: Record<string, string> = {
    CAPTURE: "via capture",
    MANUAL: "manual",
    WEEKLY_REVIEW: "weekly review",
    AI_REFLECTION: "AI reflection",
  };
  return map[source] ?? source.toLowerCase();
}

function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
