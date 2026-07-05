import { prisma } from "@/lib/prisma";
import type { CaptureResult } from "@/lib/ai/types";
import type {
  AnswerFollowUpQuestionPayload,
  FollowUpQuestionPayload,
  GrowthCategory,
  GrowthItemPayload,
  PlannedAction,
} from "./types";

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

export async function planGrowthFromCapture(
  userId: string,
  text: string,
  capture: CaptureResult,
): Promise<PlannedAction[]> {
  const actions: PlannedAction[] = [];

  const answeredQuestion = await findAnsweredQuestion(userId, text);
  if (answeredQuestion) {
    const payload: AnswerFollowUpQuestionPayload = {
      questionId: answeredQuestion.id,
      question: answeredQuestion.question,
      answer: text,
    };
    actions.push({
      id: nextId("question-answer"),
      type: "ANSWER_FOLLOW_UP_QUESTION",
      label: `Answer: ${answeredQuestion.question}`,
      payload,
    });
  }

  const growthItems = inferGrowthItems(text, capture);
  actions.push(
    ...growthItems.map((payload) => ({
      id: nextId("growth"),
      type: "CREATE_GROWTH_ITEM" as const,
      label: `Growth: ${payload.title}`,
      payload,
    })),
  );

  const questions = inferFollowUpQuestions(text, capture, growthItems);
  actions.push(
    ...questions.map((payload) => ({
      id: nextId("growth-question"),
      type: "CREATE_FOLLOW_UP_QUESTION" as const,
      label: `Question: ${payload.question}`,
      payload,
    })),
  );

  return actions;
}

export async function planGrowthFromText(userId: string, text: string): Promise<PlannedAction[]> {
  const answeredQuestion = await findAnsweredQuestion(userId, text);
  if (!answeredQuestion) return [];

  return [{
    id: nextId("question-answer"),
    type: "ANSWER_FOLLOW_UP_QUESTION",
    label: `Answer: ${answeredQuestion.question}`,
    payload: {
      questionId: answeredQuestion.id,
      question: answeredQuestion.question,
      answer: text,
    },
  }];
}

function inferGrowthItems(text: string, capture: CaptureResult): GrowthItemPayload[] {
  const lower = text.toLowerCase();
  const items: GrowthItemPayload[] = [];
  const category = inferGrowthCategory(lower);

  if (category && isLearningCapture(lower, capture)) {
    const title = buildGrowthTitle(text, category);
    items.push({
      category,
      title,
      description: capture.data.summary || capture.reflection || text,
      currentStage: lower.includes("practice") || lower.includes("practicing") ? "PRACTICING" : "LEARNED",
      lastReviewed: dateISO(0),
      nextReview: dateISO(category === "VOCABULARY" ? 1 : 3),
      confidence: "MEDIUM",
      sourceCaptureId: null,
    });
  }

  for (const memory of capture.data.memoryCandidates) {
    if (!/learn|lesson|insight|realized|read|book|course|practice/i.test(`${memory.title} ${memory.content}`)) continue;
    items.push({
      category: inferGrowthCategory(`${memory.title} ${memory.content}`.toLowerCase()) ?? "OTHER",
      title: memory.title,
      description: memory.content,
      currentStage: "LEARNED",
      lastReviewed: dateISO(0),
      nextReview: dateISO(3),
      confidence: memory.importance === "HIGH" || memory.importance === "PERMANENT" ? "HIGH" : "MEDIUM",
      sourceCaptureId: null,
    });
  }

  return dedupeGrowthItems(items).slice(0, 3);
}

function inferFollowUpQuestions(
  text: string,
  capture: CaptureResult,
  growthItems: GrowthItemPayload[],
): FollowUpQuestionPayload[] {
  const lower = text.toLowerCase();
  const questions: FollowUpQuestionPayload[] = [];

  if (/\b(skip|skipped|not today|missed|didn't go|did not go)\b/.test(lower) && lower.includes("dance")) {
    questions.push({
      category: "DANCE",
      question: "What made dance worth skipping today?",
      reason: "Skipped dance can reveal an energy, schedule, or motivation pattern.",
      priority: "MEDIUM",
      relatedEntityType: "CAPTURE",
      relatedEntityId: "dance",
    });
  }

  for (const person of capture.data.peopleUpdates) {
    questions.push({
      category: "RELATIONSHIP",
      question: `How did the interaction with ${person.personName} feel?`,
      reason: "Relationship context becomes more useful when the emotional tone is captured.",
      priority: "MEDIUM",
      relatedEntityType: "PERSON_NAME",
      relatedEntityId: person.personName,
    });
  }

  if (/\b(gym|workout|lift|run|cardio|training)\b/.test(lower)) {
    questions.push({
      category: "FITNESS",
      question: "How difficult did the workout feel?",
      reason: "Workout difficulty helps Talal OS notice load, recovery, and consistency patterns.",
      priority: "MEDIUM",
      relatedEntityType: "CAPTURE",
      relatedEntityId: "fitness",
    });
  }

  if (/\b(book|read|reading|chapter|article)\b/.test(lower)) {
    questions.push({
      category: "READING",
      question: "What is the one idea from this reading worth remembering?",
      reason: "Reading becomes useful when the retained idea is captured.",
      priority: "HIGH",
      relatedEntityType: "CAPTURE",
      relatedEntityId: "reading",
    });
  }

  if (/\b(project|startup|business|client|course)\b/.test(lower) && /\b(started|new|begin|launch|idea)\b/.test(lower)) {
    questions.push({
      category: inferGrowthCategory(lower) ?? "BUSINESS",
      question: "Should this still be active next week?",
      reason: "New initiatives need a later check so stale projects do not accumulate.",
      priority: "LOW",
      relatedEntityType: "CAPTURE",
      relatedEntityId: "initiative",
    });
  }

  for (const item of growthItems) {
    if (item.category === "VOCABULARY") {
      questions.push({
        category: "VOCABULARY",
        question: `Can you use "${item.title}" naturally in a sentence?`,
        reason: "Vocabulary sticks better when reviewed through active recall.",
        priority: "HIGH",
        relatedEntityType: "GROWTH_ITEM_TITLE",
        relatedEntityId: item.title,
      });
    } else {
      questions.push({
        category: item.category,
        question: `What is the next small practice step for ${item.title}?`,
        reason: "Growth items improve when the next practice step is explicit.",
        priority: "MEDIUM",
        relatedEntityType: "GROWTH_ITEM_TITLE",
        relatedEntityId: item.title,
      });
    }
  }

  return dedupeQuestions(questions).slice(0, 3);
}

async function findAnsweredQuestion(
  userId: string,
  text: string,
): Promise<{ id: string; question: string; category: GrowthCategory } | null> {
  const lower = text.toLowerCase();
  if (lower.length < 12) return null;

  const pending = await prisma.followUpQuestion.findMany({
    where: { userId, status: "OPEN" },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 3,
  });

  if (pending.length === 0) return null;

  const explicitAnswer = /^(answer|answering|answered|re:|regarding|about)\b/i.test(text.trim());
  const answerCue = /\b(because|felt|feel|learned|realized|it was|the reason|difficult|easy|hard|remember|next step)\b/.test(lower);

  for (const question of pending) {
    const score = scoreQuestionMatch(lower, question.question.toLowerCase(), question.category);
    if (explicitAnswer || (answerCue && score >= 2) || score >= 4) {
      return {
        id: question.id,
        question: question.question,
        category: question.category as GrowthCategory,
      };
    }
  }

  return null;
}

function scoreQuestionMatch(text: string, question: string, category: GrowthCategory): number {
  let score = 0;
  for (const keyword of CATEGORY_KEYWORDS[category] ?? []) {
    if (text.includes(keyword)) score += 2;
  }
  for (const token of question.split(/\W+/).filter((word) => word.length > 4 && !STOPWORDS.has(word))) {
    if (text.includes(token)) score += 1;
  }
  return score;
}

function inferGrowthCategory(text: string): GrowthCategory | null {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[GrowthCategory, string[]]>) {
    if (keywords.some((keyword) => text.includes(keyword))) return category;
  }
  return null;
}

function isLearningCapture(text: string, capture: CaptureResult): boolean {
  if (/\b(learned|learnt|studied|practiced|practising|practice|review|read|reading|book|course|lesson|vocab|word|phrase|skill)\b/.test(text)) {
    return true;
  }
  return capture.data.memoryCandidates.some((memory) =>
    /\b(learned|lesson|insight|realized|skill|practice)\b/i.test(`${memory.title} ${memory.content}`),
  );
}

function buildGrowthTitle(text: string, category: GrowthCategory): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^(i\s+)?(learned|learnt|studied|practiced|read|reviewed)\s+/i, "")
    .trim();

  if (category === "VOCABULARY") {
    const quoted = cleaned.match(/["“”']([^"“”']{2,60})["“”']/)?.[1];
    if (quoted) return quoted;
    const wordMatch = cleaned.match(/\b(?:word|phrase|vocab(?:ulary)?)\s+([a-zA-Z-]{2,40})/i)?.[1];
    if (wordMatch) return wordMatch;
  }

  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}…` : cleaned || titleCase(category);
}

function dedupeGrowthItems(items: GrowthItemPayload[]): GrowthItemPayload[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeQuestions(questions: FollowUpQuestionPayload[]): FollowUpQuestionPayload[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    const key = question.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dateISO(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split("T")[0]!;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_, prefix: string, letter: string) =>
    `${prefix ? " " : ""}${letter.toUpperCase()}`,
  );
}

const CATEGORY_KEYWORDS: Record<GrowthCategory, string[]> = {
  VOCABULARY: ["vocab", "vocabulary", "word", "phrase", "definition", "pronunciation"],
  DANCE: ["dance", "bachata", "salsa", "performance", "choreo", "choreography"],
  FITNESS: ["gym", "workout", "fitness", "lift", "run", "cardio", "training"],
  HEALTH: ["health", "sick", "doctor", "sleep", "medicine", "recovery", "pain"],
  CAREER: ["career", "job", "interview", "resume", "promotion", "work"],
  RELATIONSHIP: ["relationship", "friend", "met", "talked", "sarah", "sara", "family"],
  COMMUNICATION: ["communication", "conversation", "texted", "message", "explained"],
  PUBLIC_SPEAKING: ["public speaking", "presentation", "speech", "presented", "talk"],
  READING: ["read", "reading", "book", "chapter", "article"],
  BUSINESS: ["business", "client", "startup", "invoice", "lead", "sales"],
  OTHER: ["learned", "lesson", "skill", "practice", "course"],
};

const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "could",
  "should",
  "today",
  "later",
  "question",
  "worth",
  "remembering",
  "naturally",
]);
