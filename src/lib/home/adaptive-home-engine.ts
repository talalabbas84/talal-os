// Adaptive Home Engine — the single public API.
// Call computeAdaptiveLayout() from page.tsx with all pre-fetched data.
// Returns a HomeLayout (mode + ordered section IDs) and the HomeContext.

export { buildHomeLayout } from "./home-layout";
export { buildHomeContext } from "./home-context";
export type { HomeLayout, HomeContext, HomeMode, SectionId, SectionData } from "./home-types";
