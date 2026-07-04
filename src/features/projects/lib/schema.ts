import { z } from "zod";

export const projectSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().max(2000).optional(),
  status: z.enum(["ACTIVE", "BACKLOG", "PAUSED", "COMPLETED"]).default("ACTIVE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export type ProjectInput = z.infer<typeof projectSchema>;
