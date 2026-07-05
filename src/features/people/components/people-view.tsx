"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Users, Search, ChevronRight } from "lucide-react";
import type { PersonWithCounts } from "../actions/people.actions";
import { cn } from "@/utils/cn";

export function PeopleView({ people }: { people: PersonWithCounts[] }) {
  const [query, setQuery] = useState("");

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    (p.nickname && p.nickname.toLowerCase().includes(query.toLowerCase())) ||
    (p.relationshipType && p.relationshipType.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            People
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {people.length} {people.length === 1 ? "person" : "people"} in your memory
          </p>
        </div>
      </div>

      {people.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full rounded-xl border border-neutral-200 bg-white py-2.5 pl-9 pr-4 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50 dark:placeholder-neutral-500"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState hasQuery={!!query} />
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
          {filtered.map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </div>
      )}

      {people.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">
            People appear here when you mention them in a capture. Try: &ldquo;I met Sarah today at the gym&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function PersonRow({ person }: { person: PersonWithCounts }) {
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        {person.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">
            {person.name}
          </p>
          {person.nickname && (
            <span className="text-xs text-neutral-400">&ldquo;{person.nickname}&rdquo;</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          {person.relationshipType && (
            <span className="text-xs text-neutral-400 capitalize">{person.relationshipType}</span>
          )}
          {person.relationshipType && (person._count.memories > 0 || person._count.interactions > 0) && (
            <span className="text-neutral-200 dark:text-neutral-700">·</span>
          )}
          {person._count.memories > 0 && (
            <span className="text-xs text-neutral-400">
              {person._count.memories} {person._count.memories === 1 ? "memory" : "memories"}
            </span>
          )}
          {person._count.memories > 0 && person._count.interactions > 0 && (
            <span className="text-neutral-200 dark:text-neutral-700">·</span>
          )}
          {person._count.interactions > 0 && (
            <span className="text-xs text-neutral-400">
              {person._count.interactions} {person._count.interactions === 1 ? "interaction" : "interactions"}
            </span>
          )}
          {person._count.insights > 0 && (
            <>
              <span className="text-neutral-200 dark:text-neutral-700">·</span>
              <span className="text-xs text-neutral-400">
                {person._count.insights} {person._count.insights === 1 ? "insight" : "insights"}
              </span>
            </>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300 dark:text-neutral-600" />
    </Link>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white py-16 dark:border-neutral-800 dark:bg-neutral-900">
      <Users className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
      <p className="text-sm text-neutral-400">
        {hasQuery ? "No people match your search." : "No people yet."}
      </p>
    </div>
  );
}
