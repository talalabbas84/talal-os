import { KnowledgeGraphRelation, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { PlannedAction } from "@/lib/intelligence/types";
import type {
  CaptureKnowledgeContext,
  KnowledgeEntityRef,
  KnowledgeGraphLinkDraft,
} from "./types";

export function entityRef(
  type: KnowledgeEntityRef["type"],
  id: string,
  label?: string | null,
  metadata?: Record<string, unknown> | null,
): KnowledgeEntityRef {
  return { type, id, label, metadata };
}

export async function createCaptureRecordFromActions(
  userId: string,
  actions: PlannedAction[],
): Promise<KnowledgeEntityRef | null> {
  const understanding = actions.find((action) => action.type === "CREATE_EXPRESSION_REWRITE");
  if (!understanding || understanding.type !== "CREATE_EXPRESSION_REWRITE") return null;

  const created = await prisma.captureRecord.create({
    data: {
      userId,
      rawText: understanding.payload.rawText,
      cleanedText: understanding.payload.articulatedText,
      summary: understanding.payload.improvedText,
      intent: inferIntentFromActions(actions),
      metadata: toJson({
        actionTypes: Array.from(new Set(actions.map((action) => action.type))),
        clarificationQuestion: understanding.payload.clarificationQuestion,
      }),
    },
  });

  return entityRef("CAPTURE", created.id, created.summary ?? created.cleanedText);
}

export function createKnowledgeContext(capture: KnowledgeEntityRef | null): CaptureKnowledgeContext {
  return { capture, entities: [], links: [] };
}

export function rememberEntity(context: CaptureKnowledgeContext, entity: KnowledgeEntityRef): void {
  context.entities.push(entity);
  if (context.capture) {
    context.links.push({
      source: entity,
      relation: KnowledgeGraphRelation.CREATED_FROM,
      target: context.capture,
      confidence: "HIGH",
      evidence: entity.label ?? null,
    });
  }
}

export function rememberLink(context: CaptureKnowledgeContext, link: KnowledgeGraphLinkDraft): void {
  context.links.push(link);
}

export async function persistKnowledgeGraphLinks(
  userId: string,
  context: CaptureKnowledgeContext,
): Promise<void> {
  const links = dedupeLinks(inferAutomaticLinks(context));
  for (const link of links) {
    await prisma.knowledgeGraphEdge.upsert({
      where: {
        userId_sourceType_sourceId_relation_targetType_targetId: {
          userId,
          sourceType: link.source.type,
          sourceId: link.source.id,
          relation: link.relation,
          targetType: link.target.type,
          targetId: link.target.id,
        },
      },
      create: {
        userId,
        sourceType: link.source.type,
        sourceId: link.source.id,
        relation: link.relation,
        targetType: link.target.type,
        targetId: link.target.id,
        confidence: link.confidence ?? "MEDIUM",
        evidence: link.evidence ?? null,
        metadata: nullableJson(link.metadata),
      },
      update: {
        confidence: link.confidence ?? "MEDIUM",
        evidence: link.evidence ?? undefined,
        metadata: nullableJson(link.metadata),
      },
    });
  }
}

function inferAutomaticLinks(context: CaptureKnowledgeContext): KnowledgeGraphLinkDraft[] {
  const links = [...context.links];
  const people = context.entities.filter((entity) => entity.type === "PERSON");

  for (const entity of context.entities) {
    const personId = entity.metadata?.relatedPersonId;
    if (typeof personId === "string") {
      const person = people.find((candidate) => candidate.id === personId) ?? entityRef("PERSON", personId);
      links.push({
        source: entity,
        relation: entity.type === "EVENT"
          ? KnowledgeGraphRelation.SCHEDULED_WITH
          : KnowledgeGraphRelation.REFERENCES_PERSON,
        target: person,
        confidence: "HIGH",
        evidence: entity.label ?? null,
      });
    }

    const projectId = entity.metadata?.projectId;
    if (typeof projectId === "string") {
      links.push({
        source: entity,
        relation: KnowledgeGraphRelation.BELONGS_TO_PROJECT,
        target: entityRef("PROJECT", projectId),
        confidence: "HIGH",
        evidence: entity.label ?? null,
      });
    }
  }

  return links;
}

function dedupeLinks(links: KnowledgeGraphLinkDraft[]): KnowledgeGraphLinkDraft[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = [
      link.source.type,
      link.source.id,
      link.relation,
      link.target.type,
      link.target.id,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferIntentFromActions(actions: PlannedAction[]): string {
  if (actions.some((action) => action.type === "CREATE_EVENT_PLACEHOLDER")) return "EVENT";
  if (actions.some((action) => action.type === "CREATE_PERSON_UPDATE")) return "PEOPLE";
  if (actions.some((action) => action.type === "CREATE_LEARNING_ITEM")) return "LEARNING";
  if (actions.some((action) => action.type === "CREATE_THOUGHT")) return "THOUGHT";
  if (actions.some((action) => action.type === "CREATE_TASK")) return "TASK";
  if (actions.some((action) => action.type === "UPDATE_JOURNAL")) return "REFLECTION";
  return "CAPTURE";
}

function nullableJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return toJson(value);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}
