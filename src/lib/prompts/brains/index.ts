import { ArticulationPrompt } from "./articulation";
import { CoachPrompt } from "./coach";
import { DecisionPrompt } from "./decision";
import { UnderstandingPrompt } from "./understanding";
import { FinancePrompt } from "./finance";
import { GeneralPrompt } from "./general";
import { HealthPrompt } from "./health";
import { MemoryPrompt } from "./memory";
import { PeoplePrompt } from "./people";
import { PlanningPrompt } from "./planning";
import { ReflectionPrompt } from "./reflection";
import type { BrainName, BrainPrompt } from "../builders/types";

export const brainPrompts = {
  articulation: ArticulationPrompt,
  understanding: UnderstandingPrompt,
  decision: DecisionPrompt,
  planning: PlanningPrompt,
  reflection: ReflectionPrompt,
  coach: CoachPrompt,
  memory: MemoryPrompt,
  people: PeoplePrompt,
  health: HealthPrompt,
  finance: FinancePrompt,
  general: GeneralPrompt,
} satisfies Record<BrainName, BrainPrompt>;

export const brainOptions = Object.values(brainPrompts);

export function getBrainPrompt(brain: BrainName): BrainPrompt {
  return brainPrompts[brain];
}

export {
  ArticulationPrompt,
  CoachPrompt,
  DecisionPrompt,
  UnderstandingPrompt,
  FinancePrompt,
  GeneralPrompt,
  HealthPrompt,
  MemoryPrompt,
  PeoplePrompt,
  PlanningPrompt,
  ReflectionPrompt,
};
