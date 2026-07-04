import { z } from "zod";

export const habitSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(1000).optional(),
  frequency: z.enum(["DAILY", "WEEKLY"]).default("DAILY"),
});

export type HabitInput = z.infer<typeof habitSchema>;
