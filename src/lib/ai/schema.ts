import { z } from "zod";

// ── Confidence ────────────────────────────────────────────────────────────────
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

// ── Level (importance / urgency / energy) ─────────────────────────────────────
export const levelSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type Level = z.infer<typeof levelSchema>;

// ── Memory enums ──────────────────────────────────────────────────────────────

export const MEMORY_TYPES = [
  "IDENTITY",
  "LIFE_PRINCIPLE",
  "PRODUCT_DECISION",
  "PRODUCT_CONTEXT",
  "LESSON_LEARNED",
  "CURRENT_STATE",
  "RELATIONSHIP_INSIGHT",
  "HEALTH_INSIGHT",
  "FINANCE_INSIGHT",
  "BUSINESS_IDEA",
  "PERSONAL_PATTERN",
] as const;

export const MEMORY_IMPORTANCES = ["LOW", "MEDIUM", "HIGH", "PERMANENT"] as const;

// ── Item schemas ──────────────────────────────────────────────────────────────

export const taskOutputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),

  // Time awareness
  dueDate: z.string().nullable().default(null),   // "YYYY-MM-DD"
  dueTime: z.string().nullable().default(null),   // "morning" | "afternoon" | "evening" | "night"
  timeContext: z.string().nullable().default(null), // "tonight" | "after_work" | "before_dance" …

  // Reminder intent
  needsReminder: z.boolean().default(false),

  // Priority matrix
  importance: levelSchema.default("MEDIUM"),
  urgency: levelSchema.default("MEDIUM"),
  energyRequired: levelSchema.default("MEDIUM"),

  projectName: z.string().nullable().default(null),
  confidence: confidenceSchema.default("high"),
});

export const ideaOutputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  category: z.string().default("Business"),
  confidence: confidenceSchema.default("medium"),
});

export const journalOutputSchema = z.object({
  accomplished: z.string().default(""),
  distractedBy: z.string().default(""),
  improveTomorrow: z.string().default(""),
  feeling: z.string().default(""),
});

export const habitOutputSchema = z.object({
  name: z.string().min(1),
  completed: z.boolean().default(false),
  note: z.string().default(""),
  confidence: confidenceSchema.default("high"),
});

export const projectOutputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("LOW"),
  confidence: confidenceSchema.default("medium"),
});

export const reminderOutputSchema = z.object({
  title: z.string().min(1).max(255),
  when: z.string().nullable().default(null),
  confidence: confidenceSchema.default("medium"),
});

export const eventPlaceholderOutputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  date: z.string().nullable().default(null),
  time: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  relatedPersonName: z.string().nullable().default(null),
  needsReminder: z.boolean().default(true),
  confidence: confidenceSchema.default("medium"),
});

export const memoryCandidateSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z.enum(MEMORY_TYPES),
  importance: z.enum(MEMORY_IMPORTANCES),
  reason: z.string().min(1),
});

// ── Command schema ────────────────────────────────────────────────────────────

export const COMMAND_TYPES = [
  "COMPLETE_TASK",   // "I finished X", "Mark X done"
  "COMPLETE_HABIT",  // explicit habit completion
  "RESCHEDULE_TASK", // "Move X to tomorrow"
  "ADD_REMINDER",    // "Remind me to X"
] as const;

export const commandOutputSchema = z.object({
  type: z.enum(COMMAND_TYPES),
  target: z.string().min(1).max(255),   // task/habit name to match
  details: z.string().nullable().default(null), // e.g. "tomorrow" for RESCHEDULE
  confidence: confidenceSchema.default("high"),
});

// ── People schemas ────────────────────────────────────────────────────────────

export const PERSON_MEMORY_TYPES = [
  "BIRTHDAY", "PREFERENCE", "STORY", "BOUNDARY",
  "COMMUNICATION_STYLE", "IMPORTANT_EVENT", "FOLLOW_UP", "GENERAL",
] as const;

export const INSIGHT_TYPES = [
  "COMMUNICATION_STYLE", "SOCIAL_STYLE", "POSSIBLE_VALUES",
  "ENERGY_PATTERN", "TRUST_PATTERN", "COMPATIBILITY_NOTE",
  "HOW_TO_APPROACH", "GENERAL",
] as const;

export const INSIGHT_CONFIDENCES = ["LOW", "MEDIUM", "HIGH"] as const;

export const personInsightItemSchema = z.object({
  type: z.enum(INSIGHT_TYPES),
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  confidence: z.enum(INSIGHT_CONFIDENCES),
  evidence: z.array(z.string()).default([]),
});

export const personDataSchema = z.object({
  nickname: z.string().nullable().default(null),
  relationshipType: z.string().nullable().default(null),
  firstMetDate: z.string().nullable().default(null),
  firstMetLocation: z.string().nullable().default(null),
  birthday: z.string().nullable().default(null),
  occupation: z.string().nullable().default(null),
  hometown: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const PERSON_DATA_DEFAULT = {
  nickname: null, relationshipType: null, firstMetDate: null,
  firstMetLocation: null, birthday: null, occupation: null,
  hometown: null, notes: null,
} as const;

export const personMemoryItemSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  type: z.enum(PERSON_MEMORY_TYPES),
  importance: z.enum(MEMORY_IMPORTANCES),
});

export const personInteractionItemSchema = z.object({
  date: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  summary: z.string().min(1),
  topics: z.array(z.string()).default([]),
  context: z.string().nullable().default(null),
  sentiment: z.string().nullable().default(null),
  followUpNeeded: z.boolean().default(false),
  followUpDate: z.string().nullable().default(null),
});

export const followUpTaskItemSchema = z.object({
  title: z.string().min(1).max(255),
  dueDate: z.string().nullable().default(null),
});

export const personUpdateSchema = z.object({
  personName: z.string().min(1).max(255),
  personData: personDataSchema.default(PERSON_DATA_DEFAULT),
  memories: z.array(personMemoryItemSchema).default([]),
  interaction: personInteractionItemSchema.nullable().default(null),
  followUpTask: followUpTaskItemSchema.nullable().default(null),
  insights: z.array(personInsightItemSchema).default([]),
  confidence: confidenceSchema.default("high"),
  reason: z.string().min(1),
});

// ── Full capture data ─────────────────────────────────────────────────────────

export const captureDataSchema = z.object({
  summary: z.string().default(""),
  mood: z.string().optional(),
  healthStatus: z.string().optional(),
  tasks: z.array(taskOutputSchema).default([]),
  ideas: z.array(ideaOutputSchema).default([]),
  journal: journalOutputSchema.default({
    accomplished: "",
    distractedBy: "",
    improveTomorrow: "",
    feeling: "",
  }),
  habits: z.array(habitOutputSchema).default([]),
  projects: z.array(projectOutputSchema).default([]),
  reminders: z.array(reminderOutputSchema).default([]),
  events: z.array(eventPlaceholderOutputSchema).default([]),
  memoryCandidates: z.array(memoryCandidateSchema).default([]),
  commands: z.array(commandOutputSchema).default([]),
  peopleUpdates: z.array(personUpdateSchema).default([]),
});

// ── Top-level result ──────────────────────────────────────────────────────────

export const captureResultSchema = z.object({
  reflection: z.string().min(1),
  data: captureDataSchema,
});

// ── Intent schema ─────────────────────────────────────────────────────────────

export const INTENT_VALUES = [
  "CREATE", "UPDATE", "MEMORY", "DECISION", "PLAN",
  "QUESTION", "REFLECTION", "JOURNAL", "UNKNOWN",
] as const;

export const intentResultSchema = z.object({
  intent: z.enum(INTENT_VALUES),
  confidence: confidenceSchema,
  reason: z.string().min(1),
});

// ── Recommendation schema ─────────────────────────────────────────────────────

export const recommendationSchema = z.object({
  summary: z.string().min(1),
  reasoning: z.string().min(1),
  topTask: z.string().nullable().default(null),
  thingsToIgnore: z.array(z.string()).default([]),
  suggestedMode: z.enum(["RECOVERY", "FOCUS", "NORMAL"]).nullable().default(null),
});

// ── Reflection schema ─────────────────────────────────────────────────────────

export const reflectionResultSchema = z.object({
  reflection: z.string().min(1),
  journal: journalOutputSchema,
  memoryCandidates: z.array(memoryCandidateSchema).default([]),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type TaskOutput = z.infer<typeof taskOutputSchema>;
export type IdeaOutput = z.infer<typeof ideaOutputSchema>;
export type JournalOutput = z.infer<typeof journalOutputSchema>;
export type HabitOutput = z.infer<typeof habitOutputSchema>;
export type ProjectOutput = z.infer<typeof projectOutputSchema>;
export type ReminderOutput = z.infer<typeof reminderOutputSchema>;
export type EventPlaceholderOutput = z.infer<typeof eventPlaceholderOutputSchema>;
export type MemoryCandidateOutput = z.infer<typeof memoryCandidateSchema>;
export type CommandOutput = z.infer<typeof commandOutputSchema>;
export type CaptureData = z.infer<typeof captureDataSchema>;
export type CaptureResult = z.infer<typeof captureResultSchema>;
export type IntentResultOutput = z.infer<typeof intentResultSchema>;
export type RecommendationOutput = z.infer<typeof recommendationSchema>;
export type ReflectionResultOutput = z.infer<typeof reflectionResultSchema>;
export type PersonUpdateOutput = z.infer<typeof personUpdateSchema>;
export type PersonMemoryItemOutput = z.infer<typeof personMemoryItemSchema>;
export type PersonInsightItemOutput = z.infer<typeof personInsightItemSchema>;
export type PersonInteractionItemOutput = z.infer<typeof personInteractionItemSchema>;
