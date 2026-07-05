"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, MessageSquare, Trash2, Tag, Lightbulb } from "lucide-react";
import type { PersonWithAll } from "../actions/people.actions";
import { deletePersonMemory, deletePersonInteraction, deletePersonInsight } from "../actions/people.actions";
import { cn } from "@/utils/cn";

const MEMORY_TYPE_LABELS: Record<string, string> = {
  BIRTHDAY: "Birthday", PREFERENCE: "Preference", STORY: "Story",
  BOUNDARY: "Boundary", COMMUNICATION_STYLE: "Comm Style",
  IMPORTANT_EVENT: "Event", FOLLOW_UP: "Follow-Up", GENERAL: "Note",
};

const IMPORTANCE_STYLES: Record<string, string> = {
  PERMANENT: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  HIGH: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  MEDIUM: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  LOW: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const SOURCE_LABELS: Record<string, string> = {
  CAPTURE: "from capture",
  MANUAL: "manual",
  INTERACTION: "from interaction",
};

const INSIGHT_TYPE_LABELS: Record<string, string> = {
  COMMUNICATION_STYLE: "Communication", SOCIAL_STYLE: "Social Style",
  POSSIBLE_VALUES: "Possible Values", ENERGY_PATTERN: "Energy Pattern",
  TRUST_PATTERN: "Trust Pattern", COMPATIBILITY_NOTE: "Compatibility",
  HOW_TO_APPROACH: "How to Approach", GENERAL: "General",
};

const INSIGHT_CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  MEDIUM: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  LOW: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

// Ordered groups for display
const INSIGHT_GROUP_ORDER = [
  "COMMUNICATION_STYLE",
  "HOW_TO_APPROACH",
  "SOCIAL_STYLE",
  "TRUST_PATTERN",
  "ENERGY_PATTERN",
  "POSSIBLE_VALUES",
  "COMPATIBILITY_NOTE",
  "GENERAL",
] as const;

export function PersonDetailView({ person }: { person: PersonWithAll }) {
  const facts = [
    person.nickname && { label: "Also known as", value: `"${person.nickname}"` },
    person.relationshipType && { label: "Relationship", value: person.relationshipType },
    person.occupation && { label: "Occupation", value: person.occupation },
    person.hometown && { label: "From", value: person.hometown },
    person.birthday && { label: "Birthday", value: person.birthday },
    person.firstMetDate && { label: "First met", value: person.firstMetDate + (person.firstMetLocation ? ` at ${person.firstMetLocation}` : "") },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  // Group insights by type
  const insightsByType = new Map<string, PersonWithAll["insights"]>();
  for (const ins of person.insights) {
    const group = insightsByType.get(ins.type) ?? [];
    group.push(ins);
    insightsByType.set(ins.type, group);
  }
  const groupedInsights = INSIGHT_GROUP_ORDER
    .filter((t) => insightsByType.has(t))
    .map((t) => ({ type: t, label: INSIGHT_TYPE_LABELS[t] ?? t, items: insightsByType.get(t)! }));
  // Any types not in the order list go at the end
  for (const [type, items] of insightsByType) {
    if (!INSIGHT_GROUP_ORDER.includes(type as typeof INSIGHT_GROUP_ORDER[number])) {
      groupedInsights.push({ type: type as typeof INSIGHT_GROUP_ORDER[number], label: INSIGHT_TYPE_LABELS[type] ?? type, items });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/people"
          className="mb-4 flex items-center gap-1 text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          People
        </Link>

        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-lg font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {person.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {person.name}
            </h1>
            {person.relationshipType && (
              <p className="mt-0.5 text-sm capitalize text-neutral-500">{person.relationshipType}</p>
            )}
          </div>
        </div>
      </div>

      {/* Facts */}
      {facts.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-neutral-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Profile</span>
          </div>
          <dl className="space-y-2">
            {facts.map(({ label, value }) => (
              <div key={label} className="flex gap-4">
                <dt className="w-28 shrink-0 text-xs text-neutral-400">{label}</dt>
                <dd className="text-sm text-neutral-700 dark:text-neutral-300">{value}</dd>
              </div>
            ))}
          </dl>
          {person.notes && (
            <p className="mt-3 border-t border-neutral-100 pt-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {person.notes}
            </p>
          )}
        </div>
      )}

      {/* AI Insights */}
      {groupedInsights.length > 0 && (
        <Section icon={Lightbulb} title="AI Insights" count={person.insights.length}>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {groupedInsights.map(({ type, label, items }) => (
              <div key={type} className="px-5 py-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</p>
                <div className="space-y-3">
                  {items.map((ins) => (
                    <InsightRow key={ins.id} insight={ins} personId={person.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Memories */}
      <Section icon={Brain} title="Memories" count={person.memories.length}>
        {person.memories.length === 0 ? (
          <EmptySlate text="No memories yet. Mention this person in a capture to add facts automatically." />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {person.memories.map((mem) => (
              <MemoryRow key={mem.id} memory={mem} personId={person.id} />
            ))}
          </div>
        )}
      </Section>

      {/* Interactions */}
      <Section icon={MessageSquare} title="Interactions" count={person.interactions.length}>
        {person.interactions.length === 0 ? (
          <EmptySlate text="No interactions logged yet." />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {person.interactions.map((ia) => (
              <InteractionRow key={ia.id} interaction={ia} personId={person.id} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function InsightRow({
  insight,
  personId,
}: {
  insight: PersonWithAll["insights"][number];
  personId: string;
}) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  const dateStr = new Date(insight.createdAt).toLocaleDateString("en-CA", {
    month: "short", day: "numeric",
  });

  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", INSIGHT_CONFIDENCE_STYLES[insight.confidence] ?? "bg-neutral-100 text-neutral-500")}>
            {insight.confidence}
          </span>
          <span className="text-[10px] text-neutral-400">{dateStr}</span>
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{insight.title}</p>
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{insight.content}</p>
        {insight.evidence.length > 0 && (
          <div className="space-y-0.5">
            {insight.evidence.map((e, i) => (
              <p key={i} className="text-[11px] italic text-neutral-400">
                &ldquo;{e}&rdquo;
              </p>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={async () => {
          const res = await deletePersonInsight(insight.id, personId);
          if (res.success) setDeleted(true);
        }}
        className="shrink-0 text-neutral-300 transition-colors hover:text-red-400 dark:text-neutral-600"
        aria-label="Delete insight"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MemoryRow({
  memory,
  personId,
}: {
  memory: PersonWithAll["memories"][number];
  personId: string;
}) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", IMPORTANCE_STYLES[memory.importance] ?? "bg-neutral-100 text-neutral-500")}>
            {memory.importance}
          </span>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
            {MEMORY_TYPE_LABELS[memory.type] ?? memory.type}
          </span>
          <span className="text-[10px] text-neutral-400">{SOURCE_LABELS[memory.source] ?? memory.source}</span>
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{memory.title}</p>
        <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{memory.content}</p>
      </div>
      <button
        onClick={async () => {
          const res = await deletePersonMemory(memory.id, personId);
          if (res.success) setDeleted(true);
        }}
        className="shrink-0 text-neutral-300 transition-colors hover:text-red-400 dark:text-neutral-600"
        aria-label="Delete memory"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function InteractionRow({
  interaction,
  personId,
}: {
  interaction: PersonWithAll["interactions"][number];
  personId: string;
}) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">{interaction.date}</span>
          {interaction.location && (
            <span className="text-xs text-neutral-400">@ {interaction.location}</span>
          )}
          {interaction.sentiment && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] capitalize text-neutral-500 dark:bg-neutral-800">
              {interaction.sentiment}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">{interaction.summary}</p>
        {interaction.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {interaction.topics.map((t, i) => (
              <span key={i} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
                {t}
              </span>
            ))}
          </div>
        )}
        {interaction.followUpNeeded && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Follow-up needed</p>
        )}
      </div>
      <button
        onClick={async () => {
          const res = await deletePersonInteraction(interaction.id, personId);
          if (res.success) setDeleted(true);
        }}
        className="shrink-0 text-neutral-300 transition-colors hover:text-red-400 dark:text-neutral-600"
        aria-label="Delete interaction"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Section({
  icon: Icon, title, count, children,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
        <Icon className="h-4 w-4 text-neutral-400" />
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{title}</span>
        {count > 0 && (
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptySlate({ text }: { text: string }) {
  return (
    <p className="px-5 py-4 text-sm text-neutral-400">{text}</p>
  );
}
