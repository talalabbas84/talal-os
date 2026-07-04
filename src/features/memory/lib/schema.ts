import { z } from "zod";
import { MEMORY_TYPES, MEMORY_IMPORTANCES } from "@/lib/ai/schema";

export const memoryEntrySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  content: z.string().min(1, "Content is required"),
  type: z.enum(MEMORY_TYPES),
  importance: z.enum(MEMORY_IMPORTANCES),
});

export type MemoryEntryInput = z.infer<typeof memoryEntrySchema>;
