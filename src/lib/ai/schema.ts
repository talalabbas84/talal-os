import { z } from "zod";

// ── Confidence ────────────────────────────────────────────────────────────────
// high   = user explicitly stated it  ("I need to buy groceries")
// medium = reasonably inferred        ("thinking about an AI website")
// low    = uncertain / mentioned in passing — requires user confirmation before saving
export const confidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof confidenceSchema>;

// ── Item schemas ──────────────────────────────────────────────────────────────

export const taskOutputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().nullable().default(null),
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
});

// ── Top-level result (reflection + data) ──────────────────────────────────────

export const captureResultSchema = z.object({
  reflection: z.string().min(1),
  data: captureDataSchema,
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type TaskOutput = z.infer<typeof taskOutputSchema>;
export type IdeaOutput = z.infer<typeof ideaOutputSchema>;
export type JournalOutput = z.infer<typeof journalOutputSchema>;
export type HabitOutput = z.infer<typeof habitOutputSchema>;
export type ProjectOutput = z.infer<typeof projectOutputSchema>;
export type ReminderOutput = z.infer<typeof reminderOutputSchema>;
export type CaptureData = z.infer<typeof captureDataSchema>;
export type CaptureResult = z.infer<typeof captureResultSchema>;
