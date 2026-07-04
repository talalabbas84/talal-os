import { z } from "zod";
import {
  taskOutputSchema,
  ideaOutputSchema,
  habitOutputSchema,
  projectOutputSchema,
  reminderOutputSchema,
  journalOutputSchema,
} from "@/lib/ai/schema";

// Validates the payload the client sends to saveCapture.
// The client pre-filters items (based on confidence toggles) before sending.
export const saveCaptureSchema = z.object({
  tasks: z.array(taskOutputSchema),
  ideas: z.array(ideaOutputSchema),
  habits: z.array(habitOutputSchema),
  projects: z.array(projectOutputSchema),
  reminders: z.array(reminderOutputSchema),
  journal: journalOutputSchema,
  saveJournal: z.boolean(),
});

export type SaveCaptureInput = z.infer<typeof saveCaptureSchema>;
