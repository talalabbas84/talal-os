import { z } from "zod";
import {
  taskOutputSchema,
  ideaOutputSchema,
  habitOutputSchema,
  projectOutputSchema,
  reminderOutputSchema,
  journalOutputSchema,
  memoryCandidateSchema,
} from "@/lib/ai/schema";

// Validates the payload the client sends to saveCapture.
// The client pre-filters items based on the user's inclusion toggles.

const saveMemoryCandidateSchema = memoryCandidateSchema.omit({ reason: true });

export const saveCaptureSchema = z.object({
  tasks: z.array(taskOutputSchema),
  ideas: z.array(ideaOutputSchema),
  habits: z.array(habitOutputSchema),
  projects: z.array(projectOutputSchema),
  reminders: z.array(reminderOutputSchema),
  journal: journalOutputSchema,
  saveJournal: z.boolean(),
  memories: z.array(saveMemoryCandidateSchema).default([]),
});

export type SaveCaptureInput = z.infer<typeof saveCaptureSchema>;
