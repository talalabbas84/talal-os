// Assembles the final HomeLayout from context + prioritized sections.

import { prioritizeSections } from "./home-priorities";
import type { HomeContext, HomeLayout, HomeMode } from "./home-types";

const MODE_LABELS: Record<HomeMode, string> = {
  morning: "Morning",
  focus: "Focus",
  preparation: "Preparation",
  active: "Active",
  reflection: "Reflection",
  recovery: "Recovery",
};

export function buildHomeLayout(ctx: HomeContext): HomeLayout {
  const sections = prioritizeSections(ctx);
  return {
    mode: ctx.mode,
    modeLabel: MODE_LABELS[ctx.mode],
    sections,
  };
}
