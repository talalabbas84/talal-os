import { buildBridgeText } from "./context-window-prompts";
import type { WindowFrame, PersonContext } from "./context-window-types";

// Generates a single bridge recommendation connecting previous → current → next.
// Returns null if there isn't enough context to say anything meaningful.

export function generateTransitionBridge(
  previous: WindowFrame | null,
  _current: WindowFrame | null,
  next: WindowFrame | null,
  minutesUntilNext: number | null,
  personContext: PersonContext | null,
): string | null {
  // Need at least previous or next to generate a useful bridge
  if (!previous && !next && !personContext) return null;

  const prevCat = previous?.category ?? null;
  const nextCat = next?.category ?? null;

  return buildBridgeText(prevCat, nextCat, minutesUntilNext, personContext);
}
