import { z } from "zod";
import {
  taskOutputSchema,
  ideaOutputSchema,
  habitOutputSchema,
  projectOutputSchema,
  reminderOutputSchema,
  journalOutputSchema,
  memoryCandidateSchema,
  commandOutputSchema,
} from "@/lib/ai/schema";

// Validates the payload the client sends to saveCapture.
// The client pre-filters items based on the user's inclusion toggles.

const saveMemoryCandidateSchema = memoryCandidateSchema.omit({ reason: true });
const saveCommandSchema = commandOutputSchema.omit({ confidence: true });

export const saveCaptureSchema = z.object({
  tasks: z.array(taskOutputSchema),
  ideas: z.array(ideaOutputSchema),
  habits: z.array(habitOutputSchema),
  projects: z.array(projectOutputSchema),
  reminders: z.array(reminderOutputSchema),
  journal: journalOutputSchema,
  saveJournal: z.boolean(),
  memories: z.array(saveMemoryCandidateSchema).default([]),
  commands: z.array(saveCommandSchema).default([]),
});

export type SaveCaptureInput = z.infer<typeof saveCaptureSchema>;
