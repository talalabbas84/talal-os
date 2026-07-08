import type { KnowledgeGraphRelation } from "@prisma/client";

export type KnowledgeEntityType =
  | "CAPTURE"
  | "TASK"
  | "PROJECT"
  | "PERSON"
  | "PERSON_INTERACTION"
  | "PERSON_MEMORY"
  | "PERSON_INSIGHT"
  | "MEMORY"
  | "THOUGHT"
  | "THOUGHT_UNIT"
  | "LEARNING_ITEM"
  | "EVENT"
  | "HABIT"
  | "DAILY_LOG"
  | "REMINDER"
  | "FOLLOW_UP"
  | "ACTIVITY"
  | "QUESTION"
  | "GROWTH_ITEM"
  | "INBOX_ENTRY"
  | "TIMELINE_EVENT"
  | "REFLECTION";

export interface KnowledgeEntityRef {
  type: KnowledgeEntityType;
  id: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface KnowledgeGraphLinkDraft {
  source: KnowledgeEntityRef;
  relation: KnowledgeGraphRelation;
  target: KnowledgeEntityRef;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
  evidence?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CaptureKnowledgeContext {
  capture: KnowledgeEntityRef | null;
  entities: KnowledgeEntityRef[];
  links: KnowledgeGraphLinkDraft[];
}

export interface UniversalSearchResult {
  entity: KnowledgeEntityRef;
  title: string;
  excerpt?: string | null;
  source: string;
  href?: string | null;
  matchedFields: string[];
}
