// Shared types for the intelligence pipeline.
// Every stage speaks this language.

import type { MemoryCandidateOutput } from "@/lib/ai/types";
import type { TaskWithProject } from "@/types";

// ── Intent ────────────────────────────────────────────────────────────────────

export const INTENTS = [
  "CREATE",      // New tasks, ideas, reminders
  "UPDATE",      // Complete task, reschedule, mark habit
  "MEMORY",      // Pure insight / pattern / identity realization
  "DECISION",    // Overwhelmed, what should I do, I need help deciding
  "PLAN",        // Plan my day, plan my week
  "QUESTION",    // What is X, how do I Y
  "REFLECTION",  // Emotional processing, how I feel
  "JOURNAL",     // Today I did, I accomplished
  "UNKNOWN",     // Falls back to CREATE
] as const;

export type Intent = typeof INTENTS[number];

export interface IntentResult {
  intent: Intent;
  confidence: "high" | "medium" | "low";
  reason: string;
}

// ── Articulation ─────────────────────────────────────────────────────────────

export interface ArticulationResult {
  original: string;
  articulated: string;
  confidence: "high" | "medium" | "low";
  changed: boolean;
  notes: string;
}

// ── Action types ──────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  "CREATE_TASK",
  "CREATE_IDEA",
  "CREATE_MEMORY",
  "CREATE_REMINDER",
  "CREATE_FOLLOW_UP",
  "CREATE_THOUGHT_UNIT",
  "CREATE_ACTIVITY_LOG",
  "CREATE_THOUGHT",
  "CREATE_GROWTH_ITEM",
  "CREATE_LEARNING_ITEM",
  "CREATE_FOLLOW_UP_QUESTION",
  "CREATE_PROJECT",
  "CREATE_PERSON_UPDATE",
  "ANSWER_FOLLOW_UP_QUESTION",
  "COMPLETE_TASK",
  "COMPLETE_TOP_TASK",
  "COMPLETE_HABIT",
  "RESCHEDULE_TASK",
  "RESCHEDULE_TOP_TASK",
  "UPDATE_JOURNAL",
  "UPDATE_USER_STATE",
  "ENABLE_RECOVERY_MODE",
  "NO_ACTION",
] as const;

export type ActionType = typeof ACTION_TYPES[number];

// Each action is fully self-contained — the execution engine needs nothing else.
export type PlannedAction =
  | { id: string; type: "CREATE_TASK"; label: string; payload: TaskPayload }
  | { id: string; type: "CREATE_IDEA"; label: string; payload: IdeaPayload }
  | { id: string; type: "CREATE_MEMORY"; label: string; payload: MemoryPayload }
  | { id: string; type: "CREATE_REMINDER"; label: string; payload: ReminderPayload }
  | { id: string; type: "CREATE_FOLLOW_UP"; label: string; payload: FollowUpPayload }
  | { id: string; type: "CREATE_THOUGHT_UNIT"; label: string; payload: ThoughtUnitPayload }
  | { id: string; type: "CREATE_ACTIVITY_LOG"; label: string; payload: ActivityLogPayload }
  | { id: string; type: "CREATE_THOUGHT"; label: string; payload: ThoughtPayload }
  | { id: string; type: "CREATE_GROWTH_ITEM"; label: string; payload: GrowthItemPayload }
  | { id: string; type: "CREATE_LEARNING_ITEM"; label: string; payload: LearningItemPayload }
  | { id: string; type: "CREATE_FOLLOW_UP_QUESTION"; label: string; payload: FollowUpQuestionPayload }
  | { id: string; type: "CREATE_PROJECT"; label: string; payload: ProjectPayload }
  | { id: string; type: "CREATE_PERSON_UPDATE"; label: string; payload: PersonUpdatePayload }
  | { id: string; type: "ANSWER_FOLLOW_UP_QUESTION"; label: string; payload: AnswerFollowUpQuestionPayload }
  | { id: string; type: "COMPLETE_TASK"; label: string; payload: { taskTitle: string } }
  | { id: string; type: "COMPLETE_TOP_TASK"; label: string; payload: Record<string, never> }
  | { id: string; type: "COMPLETE_HABIT"; label: string; payload: { habitName: string } }
  | { id: string; type: "RESCHEDULE_TASK"; label: string; payload: { taskTitle: string; details: string | null } }
  | { id: string; type: "RESCHEDULE_TOP_TASK"; label: string; payload: { dueDate: string | null; reason: string } }
  | { id: string; type: "UPDATE_JOURNAL"; label: string; payload: JournalPayload }
  | { id: string; type: "UPDATE_USER_STATE"; label: string; payload: UserStatePayload }
  | { id: string; type: "ENABLE_RECOVERY_MODE"; label: string; payload: Record<string, never> }
  | { id: string; type: "NO_ACTION"; label: string; payload: Record<string, never> };

// ── Action payloads ───────────────────────────────────────────────────────────

export interface TaskPayload {
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  dueTime: string | null;
  timeContext: string | null;
  needsReminder: boolean;
  importance: "LOW" | "MEDIUM" | "HIGH";
  urgency: "LOW" | "MEDIUM" | "HIGH";
  energyRequired: "LOW" | "MEDIUM" | "HIGH";
  projectName?: string | null;
}

export interface IdeaPayload {
  title: string;
  description?: string;
  category: string;
}

export interface MemoryPayload {
  title: string;
  content: string;
  type: string;
  importance: string;
  source?: "CAPTURE" | "MANUAL" | "WEEKLY_REVIEW" | "AI_REFLECTION";
}

export interface ReminderPayload {
  title: string;
  when: string | null;
}

export interface FollowUpPayload {
  title: string;
  type: "TASK" | "PERSON" | "HEALTH" | "BUSINESS" | "PERSONAL";
  dueDate: string | null;
  reason?: string | null;
  createdFrom?: string | null;
}

export type ThoughtUnitType =
  | "ACTIVITY"
  | "TASK"
  | "REMINDER"
  | "PEOPLE"
  | "LEARNING"
  | "MOOD"
  | "HABIT"
  | "JOURNAL"
  | "IDEA"
  | "MEMORY"
  | "DECISION"
  | "RANDOM";

export interface ThoughtUnitPayload {
  rawText: string;
  cleanedText: string;
  type: ThoughtUnitType;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  sourceCaptureId?: string | null;
  routedTo?: string | null;
}

export type ActivityCategory =
  | "WORK"
  | "TALAL_OS"
  | "FITNESS"
  | "DANCE"
  | "FOOD"
  | "REST"
  | "SOCIAL"
  | "LEARNING"
  | "PROCRASTINATION"
  | "RECOVERY"
  | "ERRAND"
  | "OTHER";

export interface ActivityLogPayload {
  activity: string;
  category: ActivityCategory;
  startedAt?: string | null;
  endedAt?: string | null;
  energyLevel?: "LOW" | "MEDIUM" | "HIGH" | null;
  mood?: string | null;
  notes?: string | null;
  sourceCaptureId?: string | null;
}

export type ThoughtCategory =
  | "SELF_INSIGHT"
  | "IDEA"
  | "FEAR"
  | "GOAL"
  | "OBSERVATION"
  | "RELATIONSHIP"
  | "BUSINESS"
  | "HEALTH"
  | "LEARNING"
  | "RANDOM";

export interface ThoughtPayload {
  rawText: string;
  cleanedText: string;
  summary: string;
  category: ThoughtCategory;
  emotionalTone?: string | null;
  importance: "LOW" | "MEDIUM" | "HIGH" | "PERMANENT";
  relatedPeopleIds?: string[];
  relatedProjectId?: string | null;
  source: "CAPTURE" | "MANUAL" | "VOICE";
}

export type GrowthCategory =
  | "VOCABULARY"
  | "DANCE"
  | "FITNESS"
  | "HEALTH"
  | "CAREER"
  | "RELATIONSHIP"
  | "COMMUNICATION"
  | "PUBLIC_SPEAKING"
  | "READING"
  | "BUSINESS"
  | "OTHER";

export type GrowthStage = "LEARNED" | "PRACTICING" | "REVIEWING" | "MASTERED";

export type LearningCategory =
  | "VOCABULARY"
  | "DANCE"
  | "PUBLIC_SPEAKING"
  | "ACCENT"
  | "SOFTWARE"
  | "FINANCE"
  | "FITNESS"
  | "BOOK"
  | "BUSINESS"
  | "OTHER";

export interface LearningItemPayload {
  title: string;
  content: string;
  category: LearningCategory;
  source: "CAPTURE" | "MANUAL";
  difficulty: "LOW" | "MEDIUM" | "HIGH";
  masteryLevel: "NEW" | "LEARNING" | "REVIEWING" | "MASTERED";
  nextReviewAt?: string | null;
}

export interface GrowthItemPayload {
  category: GrowthCategory;
  title: string;
  description?: string | null;
  currentStage: GrowthStage;
  lastReviewed?: string | null;
  nextReview?: string | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  sourceCaptureId?: string | null;
}

export interface FollowUpQuestionPayload {
  category: GrowthCategory;
  question: string;
  reason?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface AnswerFollowUpQuestionPayload {
  questionId: string | null;
  question: string;
  answer: string;
}

export interface ProjectPayload {
  name: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface JournalPayload {
  feeling?: string;
  accomplished?: string;
  distractedBy?: string;
  improveTomorrow?: string;
}

export interface PersonInsightPayload {
  type: string;
  title: string;
  content: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidence: string[];
}

export interface PersonMemoryItemPayload {
  title: string;
  content: string;
  type: string;
  importance: string;
}

export interface PersonInteractionPayload {
  date: string | null;
  location: string | null;
  summary: string;
  topics: string[];
  context: string | null;
  sentiment: string | null;
  followUpNeeded: boolean;
  followUpDate: string | null;
}

export interface PersonUpdatePayload {
  personName: string;
  personData: {
    nickname: string | null;
    relationshipType: string | null;
    firstMetDate: string | null;
    firstMetLocation: string | null;
    birthday: string | null;
    occupation: string | null;
    hometown: string | null;
    notes: string | null;
  };
  memories: PersonMemoryItemPayload[];
  interaction: PersonInteractionPayload | null;
  followUpTask: { title: string; dueDate: string | null } | null;
  insights: PersonInsightPayload[];
}

export interface UserStatePayload {
  currentMood?: string;
  energyLevel?: "LOW" | "MEDIUM" | "HIGH";
  focusLevel?: "LOW" | "MEDIUM" | "HIGH";
  recoveryMode?: boolean;
  currentMission?: string;
  weekFocus?: string;
  lastReflection?: boolean; // flag to stamp now()
  lastPlanning?: boolean;   // flag to stamp now()
}

// ── Recommendation ────────────────────────────────────────────────────────────

export interface Recommendation {
  summary: string;
  reasoning: string;
  topTask: string | null;
  thingsToIgnore: string[];
  suggestedMode: "RECOVERY" | "FOCUS" | "NORMAL" | null;
}

// ── Reflection ────────────────────────────────────────────────────────────────

export interface ReflectionData {
  reflection: string;
  journal: JournalPayload;
  memoryCandidates: MemoryCandidateOutput[];
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export interface PlanSummary {
  topTasks: TaskWithProject[];
  habitsDue: Array<{ id: string; name: string }>;
  overdueCount: number;
  suggestion: string;
}

// ── Pipeline result ───────────────────────────────────────────────────────────
// Discriminated union — the capture-view renders based on intent.

type PipelineBase = {
  articulation: ArticulationResult;
};

export type PipelineResult = PipelineBase &
  (
    | {
      intent: "CREATE" | "UNKNOWN";
      intentResult: IntentResult;
      capture: import("@/lib/ai/types").CaptureResult;
      actions: PlannedAction[];
    }
  | {
      intent: "UPDATE";
      intentResult: IntentResult;
      commands: import("@/lib/ai/types").CommandOutput[];
      actions: PlannedAction[];
    }
  | {
      intent: "DECISION";
      intentResult: IntentResult;
      recommendation: Recommendation;
      actions: PlannedAction[];
    }
  | {
      intent: "REFLECTION" | "JOURNAL";
      intentResult: IntentResult;
      reflectionData: ReflectionData;
      actions: PlannedAction[];
    }
  | {
      intent: "QUESTION";
      intentResult: IntentResult;
      answer: string;
      actions: PlannedAction[];
    }
  | {
      intent: "PLAN";
      intentResult: IntentResult;
      plan: PlanSummary;
      actions: PlannedAction[];
    }
  | {
      intent: "MEMORY";
      intentResult: IntentResult;
      candidates: MemoryCandidateOutput[];
      actions: PlannedAction[];
    }
  );

// ── Execution result ──────────────────────────────────────────────────────────

export interface ExecutionResult {
  tasksCreated: number;
  ideasCreated: number;
  memoriesSaved: number;
  remindersCreated: number;
  followUpsCreated: number;
  thoughtUnitsCreated: number;
  activityLogsCreated: number;
  thoughtsSaved: number;
  growthItemsCreated: number;
  learningItemsCreated: number;
  questionsCreated: number;
  questionsAnswered: number;
  projectsCreated: number;
  habitsUpdated: number;
  journalSaved: boolean;
  userStateUpdated: boolean;
  commandsExecuted: number;
  peopleUpdated: number;
  insightsSaved: number;
}
