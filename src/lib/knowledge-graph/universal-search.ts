import { prisma } from "@/lib/prisma";
import type { UniversalSearchResult } from "./types";

export async function universalSearch(
  userId: string,
  query: string,
  limit = 8,
): Promise<UniversalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [
    people,
    tasks,
    projects,
    memories,
    thoughts,
    learning,
    events,
    captures,
  ] = await Promise.all([
    prisma.person.findMany({
      where: { userId, name: { contains: q, mode: "insensitive" } },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.memoryEntry.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.thought.findMany({
      where: {
        userId,
        OR: [
          { rawText: { contains: q, mode: "insensitive" } },
          { cleanedText: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.learningItem.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.eventPlaceholder.findMany({
      where: {
        userId,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { timeContext: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.captureRecord.findMany({
      where: {
        userId,
        OR: [
          { rawText: { contains: q, mode: "insensitive" } },
          { cleanedText: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...people.map((person): UniversalSearchResult => ({
      entity: { type: "PERSON", id: person.id, label: person.name },
      title: person.name,
      excerpt: person.notes,
      source: "People",
      href: `/people/${person.id}`,
      matchedFields: ["name", "notes"],
    })),
    ...tasks.map((task): UniversalSearchResult => ({
      entity: { type: "TASK", id: task.id, label: task.title },
      title: task.title,
      excerpt: task.description,
      source: "Tasks",
      href: "/tasks",
      matchedFields: ["title", "description"],
    })),
    ...projects.map((project): UniversalSearchResult => ({
      entity: { type: "PROJECT", id: project.id, label: project.name },
      title: project.name,
      excerpt: project.description,
      source: "Projects",
      href: `/projects/${project.id}`,
      matchedFields: ["name", "description"],
    })),
    ...memories.map((memory): UniversalSearchResult => ({
      entity: { type: "MEMORY", id: memory.id, label: memory.title },
      title: memory.title,
      excerpt: memory.content,
      source: "Memory",
      href: "/memory",
      matchedFields: ["title", "content"],
    })),
    ...thoughts.map((thought): UniversalSearchResult => ({
      entity: { type: "THOUGHT", id: thought.id, label: thought.summary },
      title: thought.summary,
      excerpt: thought.cleanedText,
      source: "Thoughts",
      href: "/thoughts",
      matchedFields: ["rawText", "cleanedText", "summary"],
    })),
    ...learning.map((item): UniversalSearchResult => ({
      entity: { type: "LEARNING_ITEM", id: item.id, label: item.title },
      title: item.title,
      excerpt: item.content,
      source: "Learn",
      href: "/learn",
      matchedFields: ["title", "content"],
    })),
    ...events.map((event): UniversalSearchResult => ({
      entity: { type: "EVENT", id: event.id, label: event.title },
      title: event.title,
      excerpt: event.description ?? event.timeContext,
      source: "Events",
      href: "/",
      matchedFields: ["title", "description", "timeContext"],
    })),
    ...captures.map((capture): UniversalSearchResult => ({
      entity: { type: "CAPTURE", id: capture.id, label: capture.summary ?? capture.cleanedText },
      title: capture.summary ?? capture.cleanedText,
      excerpt: capture.rawText,
      source: "Captures",
      href: "/capture",
      matchedFields: ["rawText", "cleanedText", "summary"],
    })),
  ].slice(0, limit * 3);
}
