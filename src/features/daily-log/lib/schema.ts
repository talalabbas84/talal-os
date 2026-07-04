import { z } from "zod";

export const dailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  feeling: z.string().max(2000).optional(),
  accomplished: z.string().max(2000).optional(),
  distracted: z.string().max(2000).optional(),
  improve: z.string().max(2000).optional(),
});

export type DailyLogInput = z.infer<typeof dailyLogSchema>;
