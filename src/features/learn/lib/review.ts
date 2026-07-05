import type { LearningCategory } from "@prisma/client";

export function buildReviewPrompt(item: { title: string; category: LearningCategory }): string {
  switch (item.category) {
    case "VOCABULARY":
      return `What does ${item.title} mean?`;
    case "DANCE":
      return `What was the key cue for ${item.title}?`;
    case "PUBLIC_SPEAKING":
      return `What should you remember about ${item.title}?`;
    case "BOOK":
      return `What is the core idea from ${item.title}?`;
    case "FITNESS":
      return `What is the fitness cue for ${item.title}?`;
    default:
      return `What do you remember about ${item.title}?`;
  }
}
