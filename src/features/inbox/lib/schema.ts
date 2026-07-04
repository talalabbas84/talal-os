import { z } from "zod";

export const inboxEntrySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional(),
  category: z
    .enum([
      "IDEA",
      "TASK",
      "PROJECT",
      "GOAL",
      "JOURNAL",
      "LEARNING",
      "FINANCE",
      "HEALTH",
      "DANCE",
      "BUSINESS",
      "PERSONAL",
    ])
    .optional(),
});

export const updateInboxStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["PENDING", "PROCESSED", "ARCHIVED"]),
});

export type InboxEntryInput = z.infer<typeof inboxEntrySchema>;
