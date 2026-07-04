import { z } from "zod";

export const captureTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.string().nullable().default(null),
  projectName: z.string().nullable().default(null),
});

export const captureIdeaSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().default(""),
  category: z.string().default("Business"),
});

export const captureJournalSchema = z.object({
  accomplished: z.string().default(""),
  distractedBy: z.string().default(""),
  improveTomorrow: z.string().default(""),
  feeling: z.string().default(""),
});

export const captureHabitSchema = z.object({
  name: z.string().min(1),
  completed: z.boolean().default(false),
  note: z.string().default(""),
});

export const captureProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("LOW"),
});

export const captureOutputSchema = z.object({
  summary: z.string(),
  mood: z.string().optional(),
  healthStatus: z.string().optional(),
  tasks: z.array(captureTaskSchema).default([]),
  ideas: z.array(captureIdeaSchema).default([]),
  journal: captureJournalSchema.default({
    accomplished: "",
    distractedBy: "",
    improveTomorrow: "",
    feeling: "",
  }),
  habits: z.array(captureHabitSchema).default([]),
  projects: z.array(captureProjectSchema).default([]),
});

export type CaptureOutputInput = z.infer<typeof captureOutputSchema>;
