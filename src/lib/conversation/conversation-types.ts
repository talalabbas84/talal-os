import type {
  Conversation,
  ConversationAnswer,
  ConversationMode,
  ConversationSlot,
  DiscoveryXp,
  DiscoveryXpCategory,
} from "@prisma/client";

export type CompanionMode = ConversationMode;
export type CompanionSlot = ConversationSlot;
export type XpCategory = DiscoveryXpCategory;

export interface ConversationContext {
  slot: CompanionSlot;
  recentCaptures: Array<{ title: string; description: string | null; createdAt: Date }>;
  recentThoughts: Array<{ summary: string; cleanedText: string; category: string; createdAt: Date }>;
  recentActivities: Array<{ activity: string; category: string; createdAt: Date; mood: string | null }>;
  recentPeople: Array<{ personNameSnapshot: string; summary: string; sentiment: string | null; createdAt: Date }>;
  dueLearning: Array<{ title: string; category: string; nextReviewAt: Date | null }>;
  habitsDue: Array<{ name: string }>;
  currentGrowth: Array<{ dimension: string; momentum: string; currentChallenge: string | null; nextRecommendation: string | null }>;
  recentInsights: Array<{ title: string; description: string; category: string; createdAt: Date }>;
  previousAnswers: Array<{ answer: string; insight: string | null; createdAt: Date; mode: string }>;
  xp: Array<Pick<DiscoveryXp, "category" | "xp">>;
}

export interface ConversationPromptChoice {
  mode: CompanionMode;
  slot: CompanionSlot;
  prompt: string;
  contextNote: string;
  source: Record<string, unknown>;
}

export type ConversationWithAnswers = Conversation & {
  answers: ConversationAnswer[];
};

export interface ConversationAnswerResult {
  feedback: string;
  insight: string;
  xpCategory: XpCategory;
  xpAmount: number;
  meaningful: boolean;
  followUpQuestion: string | null;
  followUpConversationId?: string | null;
}
