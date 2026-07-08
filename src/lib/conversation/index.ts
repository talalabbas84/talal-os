export { getOrCreateTodaysConversation, answerConversation } from "./conversation-engine";
export { buildConversationContext } from "./conversation-memory";
export { getCurrentConversationSlot, MAX_CONVERSATIONS_PER_DAY } from "./conversation-state";
export type {
  CompanionMode,
  CompanionSlot,
  ConversationAnswerResult,
  ConversationContext,
  ConversationPromptChoice,
  ConversationWithAnswers,
  XpCategory,
} from "./conversation-types";
