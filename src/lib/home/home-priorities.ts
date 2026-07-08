// Scores and filters sections for a given HomeContext.
// Returns sections sorted by priority (highest first), visibility-filtered.

import { SECTION_REGISTRY } from "./home-sections";
import type { HomeContext, SectionId } from "./home-types";

// Max sections per mode — keeps the home page focused
const MAX_SECTIONS: Record<string, number> = {
  morning: 6,
  focus: 4,
  preparation: 5,
  active: 6,
  reflection: 5,
  recovery: 4,
};

export function prioritizeSections(ctx: HomeContext): SectionId[] {
  const mode = ctx.mode;

  const scored = SECTION_REGISTRY
    .map((section) => {
      const score = section.modeScores[mode] ?? 0;
      if (score === 0) return null;                     // hidden in this mode
      if (!section.isVisible(ctx)) return null;          // runtime check failed
      return { id: section.id, score };
    })
    .filter((s): s is { id: SectionId; score: number } => s !== null);

  // Sort by score DESC
  scored.sort((a, b) => b.score - a.score);

  // Respect max section count
  const max = MAX_SECTIONS[mode] ?? 6;
  return scored.slice(0, max).map((s) => s.id);
}
