import type { PlannedAction } from "@/lib/intelligence/types";
import type { PersonalIntelligenceInput } from "./types";
import { generatePersonalInsights } from "./insight-engine";
import { detectPersonalPatterns } from "./pattern-engine";
import { generateCuriosityQuestion } from "./question-engine";
import { planPersonalGrowth } from "./growth-engine";
import { updateIdentityProfile } from "./identity-engine";
import { planDailyReflectionFromCapture, planTimelineEvents } from "./timeline-engine";

export async function planPersonalIntelligenceActions(input: PersonalIntelligenceInput): Promise<PlannedAction[]> {
  const text = input.cleanedText.trim();
  if (text.length < 3) return [];

  const insightActions = generatePersonalInsights(input);
  const patternActions = await detectPersonalPatterns(input);
  const questionActions = await generateCuriosityQuestion(input);
  const growthActions = planPersonalGrowth(input);
  const identityActions = updateIdentityProfile(input);
  const timelineActions = planTimelineEvents(input);
  const reflectionActions = planDailyReflectionFromCapture(input);

  return [
    ...insightActions,
    ...patternActions,
    ...questionActions.slice(0, 1),
    ...growthActions,
    ...identityActions,
    ...timelineActions,
    ...reflectionActions,
  ];
}
