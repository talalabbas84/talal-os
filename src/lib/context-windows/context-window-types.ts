export type WindowEntityType = "activity" | "event" | "task" | "habit" | "learning";

export interface WindowFrame {
  summary: string;        // human-readable label
  category: string;       // internal routing key (dance, workout, work, social_event, etc.)
  entityType?: WindowEntityType;
  entityId?: string;
}

export interface PersonContext {
  name: string;
  lastTopic?: string;     // from PersonInteraction.topics[0]
  lastSummary?: string;   // from PersonInteraction.summary (first sentence)
}

export interface ContextWindowData {
  id: string;
  userId: string;
  previous: WindowFrame | null;
  current: WindowFrame | null;
  next: WindowFrame | null;
  bridgeRecommendation: string | null;
  updatedAt: Date;
}
