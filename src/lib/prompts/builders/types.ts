export type BrainName =
  | "decision"
  | "planning"
  | "reflection"
  | "coach"
  | "memory"
  | "people"
  | "health"
  | "finance"
  | "general";

export interface PromptSection {
  name: string;
  version: string;
  description: string;
  content: string;
}

export interface BrainPrompt extends PromptSection {
  brain: BrainName;
  tone: string;
  focus: string;
}

export interface PromptContext {
  currentState?: string;
  memory?: string;
  projects?: string;
  habits?: string;
  todaysTasks?: string;
  peopleContext?: string;
  recentCaptures?: string;
  raw?: string;
}

export interface BuildPromptInput {
  brain: BrainName;
  userInput: string;
  context?: PromptContext | string;
  memories?: string[];
  currentState?: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  metadata: {
    brain: BrainName;
    brainPrompt: Pick<BrainPrompt, "name" | "version" | "description">;
    sections: Array<Pick<PromptSection, "name" | "version" | "description">>;
    estimatedTokens: number;
  };
}

export interface PromptPlaygroundResult {
  systemPrompt: string;
  userPrompt: string;
  llmResponse: string;
  tokenCount: number;
}
