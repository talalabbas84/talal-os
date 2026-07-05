"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { ActionResult } from "@/types";
import type { Person, PersonMemory, PersonInteraction, PersonInsight } from "@prisma/client";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type PersonWithCounts = Person & {
  _count: { memories: number; interactions: number; insights: number };
};

export type PersonWithAll = Person & {
  memories: PersonMemory[];
  interactions: PersonInteraction[];
  insights: PersonInsight[];
};

// ── List ──────────────────────────────────────────────────────────────────────

export async function getPeople(): Promise<ActionResult<PersonWithCounts[]>> {
  try {
    const userId = await requireUserId();
    const people = await prisma.person.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: { _count: { select: { memories: true, interactions: true, insights: true } } },
    });
    return { success: true, data: people };
  } catch {
    return { success: false, error: "Failed to load people." };
  }
}

// ── Get one ───────────────────────────────────────────────────────────────────

export async function getPerson(personId: string): Promise<ActionResult<PersonWithAll>> {
  try {
    const userId = await requireUserId();
    const person = await prisma.person.findFirst({
      where: { id: personId, userId },
      include: {
        memories: { orderBy: { createdAt: "desc" } },
        interactions: { orderBy: { date: "desc" } },
        insights: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!person) return { success: false, error: "Person not found." };
    return { success: true, data: person };
  } catch {
    return { success: false, error: "Failed to load person." };
  }
}

// ── Create person ─────────────────────────────────────────────────────────────

export async function createPerson(data: {
  name: string;
  nickname?: string;
  relationshipType?: string;
  birthday?: string;
  occupation?: string;
  hometown?: string;
  notes?: string;
}): Promise<ActionResult<Person>> {
  try {
    const userId = await requireUserId();
    if (!data.name.trim()) return { success: false, error: "Name is required." };
    const { name, ...rest } = data;
    const person = await prisma.person.create({
      data: { userId, name: name.trim(), ...rest },
    });
    revalidatePath("/people");
    return { success: true, data: person };
  } catch {
    return { success: false, error: "Failed to create person." };
  }
}

// ── Update person ─────────────────────────────────────────────────────────────

export async function updatePerson(
  personId: string,
  data: Partial<{
    name: string;
    nickname: string | null;
    relationshipType: string | null;
    birthday: string | null;
    occupation: string | null;
    hometown: string | null;
    notes: string | null;
  }>,
): Promise<ActionResult<Person>> {
  try {
    const userId = await requireUserId();
    const existing = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!existing) return { success: false, error: "Person not found." };
    const person = await prisma.person.update({ where: { id: personId }, data });
    revalidatePath("/people");
    revalidatePath(`/people/${personId}`);
    return { success: true, data: person };
  } catch {
    return { success: false, error: "Failed to update person." };
  }
}

// ── Delete person ─────────────────────────────────────────────────────────────

export async function deletePerson(personId: string): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const existing = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!existing) return { success: false, error: "Person not found." };
    await prisma.person.delete({ where: { id: personId } });
    revalidatePath("/people");
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete person." };
  }
}

// ── Person memories ───────────────────────────────────────────────────────────

export async function createPersonMemory(
  personId: string,
  data: {
    title: string;
    content: string;
    type: string;
    importance: string;
  },
): Promise<ActionResult<PersonMemory>> {
  try {
    const userId = await requireUserId();
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) return { success: false, error: "Person not found." };
    const memory = await prisma.personMemory.create({
      data: {
        userId,
        personId,
        title: data.title,
        content: data.content,
        type: data.type as Parameters<typeof prisma.personMemory.create>[0]["data"]["type"],
        importance: data.importance as Parameters<typeof prisma.personMemory.create>[0]["data"]["importance"],
        source: "MANUAL",
      },
    });
    revalidatePath(`/people/${personId}`);
    return { success: true, data: memory };
  } catch {
    return { success: false, error: "Failed to save memory." };
  }
}

export async function deletePersonMemory(
  memoryId: string,
  personId: string,
): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const memory = await prisma.personMemory.findFirst({ where: { id: memoryId, userId } });
    if (!memory) return { success: false, error: "Memory not found." };
    await prisma.personMemory.delete({ where: { id: memoryId } });
    revalidatePath(`/people/${personId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete memory." };
  }
}

// ── Person interactions ───────────────────────────────────────────────────────

export async function createPersonInteraction(
  personId: string,
  data: {
    date: string;
    location?: string;
    summary: string;
    topics?: string[];
    sentiment?: string;
    followUpNeeded?: boolean;
  },
): Promise<ActionResult<PersonInteraction>> {
  try {
    const userId = await requireUserId();
    const person = await prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) return { success: false, error: "Person not found." };
    const interaction = await prisma.personInteraction.create({
      data: {
        userId,
        personId,
        personNameSnapshot: person.name,
        date: data.date,
        location: data.location ?? null,
        summary: data.summary,
        topics: data.topics ?? [],
        sentiment: data.sentiment ?? null,
        followUpNeeded: data.followUpNeeded ?? false,
      },
    });
    revalidatePath(`/people/${personId}`);
    return { success: true, data: interaction };
  } catch {
    return { success: false, error: "Failed to save interaction." };
  }
}

export async function deletePersonInteraction(
  interactionId: string,
  personId: string,
): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const interaction = await prisma.personInteraction.findFirst({ where: { id: interactionId, userId } });
    if (!interaction) return { success: false, error: "Interaction not found." };
    await prisma.personInteraction.delete({ where: { id: interactionId } });
    revalidatePath(`/people/${personId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete interaction." };
  }
}

// ── Person insights ───────────────────────────────────────────────────────────

export async function deletePersonInsight(
  insightId: string,
  personId: string,
): Promise<ActionResult<void>> {
  try {
    const userId = await requireUserId();
    const insight = await prisma.personInsight.findFirst({ where: { id: insightId, userId } });
    if (!insight) return { success: false, error: "Insight not found." };
    await prisma.personInsight.delete({ where: { id: insightId } });
    revalidatePath(`/people/${personId}`);
    return { success: true, data: undefined };
  } catch {
    return { success: false, error: "Failed to delete insight." };
  }
}
