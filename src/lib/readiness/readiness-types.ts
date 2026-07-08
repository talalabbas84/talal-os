import type { ReadinessEntityType, ReadinessStatus, ReadinessLevel } from "@prisma/client";

export type { ReadinessEntityType, ReadinessStatus, ReadinessLevel };

export interface PreparedItem {
  label: string;
}

export interface MissingItem {
  label: string;
  priority: "high" | "medium" | "low";
}

export interface ReadinessRecommendation {
  text: string;
  context?: string;
}

// Stored plan shape returned to UI
export interface ReadinessPlanData {
  id: string;
  entityType: ReadinessEntityType;
  entityId?: string | null;
  title: string;
  scheduledFor: Date;
  status: ReadinessStatus;
  overallReadiness: ReadinessLevel;
  preparedItems: PreparedItem[];
  missingItems: MissingItem[];
  recommendations: ReadinessRecommendation[];
  focusTip?: string | null;
  generatedAt: Date;
}

// Input to the builder when generating a plan
export interface ReadinessInput {
  userId: string;
  entityType: ReadinessEntityType;
  entityId?: string;
  title: string;
  scheduledFor: Date;
  location?: string;
  description?: string;
  linkedPersonId?: string;
  linkedPersonName?: string;
}

// Template for a detected event category
export interface ReadinessTemplate {
  category: string;
  keywords: string[];
  checklistItems: string[];           // ordered by importance
  highPriority: string[];             // subset that are HIGH priority
  focusHints: string[];               // rotating tips
}

// Detected category from event title/description
export type EventCategory =
  | "dance_performance"
  | "dance_class"
  | "interview"
  | "dinner"
  | "date"
  | "workout"
  | "meeting"
  | "presentation"
  | "travel"
  | "doctor"
  | "networking"
  | "study"
  | "generic";
