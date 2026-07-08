// Clarification Engine — post-run DB-based ambiguity detection.
// Runs after organizeCapture() and checks if the AI's entity choices are ambiguous
// by querying the DB for multiple plausible matches. If so, surfaces a
// ClarificationRequest that the UI can present as a multiple-choice question.

import { prisma } from "@/lib/prisma";
import type { CaptureResult } from "@/lib/ai/types";
import type { ClarificationRequest, ClarificationChoice } from "./types";

interface ClarificationContext {
  userId: string;
  capture: CaptureResult;
  originalText: string;
}

export async function detectClarification(
  ctx: ClarificationContext,
): Promise<ClarificationRequest | undefined> {
  const { userId, capture } = ctx;

  // Check tasks — look at the first task for project ambiguity
  const firstTask = capture.data.tasks?.[0];
  if (firstTask?.projectName && firstTask.confidence !== "high") {
    const clarification = await checkProjectAmbiguity(userId, firstTask.projectName);
    if (clarification) return clarification;
  }

  // Check person updates for person ambiguity
  const firstPerson = capture.data.peopleUpdates?.[0];
  if (firstPerson?.personName && firstTask?.confidence !== "high") {
    const clarification = await checkPersonAmbiguity(userId, firstPerson.personName);
    if (clarification) return clarification;
  }

  return undefined;
}

async function checkProjectAmbiguity(
  userId: string,
  projectName: string,
): Promise<ClarificationRequest | undefined> {
  const normalized = projectName.toLowerCase().trim();
  if (!normalized) return undefined;

  const projects = await prisma.project.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PAUSED"] },
      name: { contains: normalized.split(" ")[0]!, mode: "insensitive" },
    },
    select: { id: true, name: true },
    take: 4,
  });

  // Only clarify if multiple projects match AND the AI's pick isn't an exact match
  const exactMatch = projects.find(
    (p) => p.name.toLowerCase() === normalized,
  );
  if (exactMatch || projects.length <= 1) return undefined;

  const choices: ClarificationChoice[] = projects.map((p) => ({
    label: p.name,
    id: p.id,
    type: "project",
  }));
  choices.push({ label: "None of these / New project", id: "__new__", type: "project" });

  return {
    question: `Which project does this task belong to?`,
    field: "projectName",
    choices: choices.slice(0, 4),
  };
}

async function checkPersonAmbiguity(
  userId: string,
  personName: string,
): Promise<ClarificationRequest | undefined> {
  const normalized = personName.toLowerCase().trim();
  if (!normalized) return undefined;

  const firstName = normalized.split(" ")[0]!;
  const people = await prisma.person.findMany({
    where: {
      userId,
      name: { contains: firstName, mode: "insensitive" },
    },
    select: { id: true, name: true },
    take: 4,
  });

  const exactMatch = people.find(
    (p) => p.name.toLowerCase() === normalized,
  );
  if (exactMatch || people.length <= 1) return undefined;

  const choices: ClarificationChoice[] = people.map((p) => ({
    label: p.name,
    id: p.id,
    type: "person",
  }));
  choices.push({ label: "Someone new", id: "__new__", type: "person" });

  return {
    question: `Which ${firstName} are you referring to?`,
    field: "person",
    choices: choices.slice(0, 4),
  };
}

// Store a clarification as a CLARIFICATION FollowUpQueue item.
// Called when ambiguity is detected so it persists across page loads.
export async function saveFollowUpClarification(
  userId: string,
  clarification: ClarificationRequest,
  originalText: string,
): Promise<string> {
  const item = await prisma.followUpQueue.create({
    data: {
      userId,
      type: "CLARIFICATION",
      priority: 9,
      question: clarification.question,
      reason: `Ambiguous capture: "${originalText.slice(0, 80)}"`,
      entityType: clarification.field,
    },
  });
  return item.id;
}
