import type { CaptureResult } from "@/lib/ai/types";
import type {
  LearningCategory,
  LearningItemPayload,
  PlannedAction,
  ThoughtCategory,
  ThoughtPayload,
} from "./types";

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

export function planThoughtAndLearningFromCapture(input: {
  rawText: string;
  cleanedText: string;
  capture: CaptureResult;
  skipThought?: boolean;
}): PlannedAction[] {
  const actions: PlannedAction[] = [];

  if (!input.skipThought && shouldSaveThought(input.rawText, input.capture)) {
    const thought = buildThought(input.rawText, input.cleanedText, input.capture);
    actions.push({
      id: nextId("thought"),
      type: "CREATE_THOUGHT",
      label: `Thought: ${thought.summary}`,
      payload: thought,
    });
  }

  const learningItems = inferLearningItems(input.cleanedText, input.capture);
  actions.push(
    ...learningItems.map((payload) => ({
      id: nextId("learning"),
      type: "CREATE_LEARNING_ITEM" as const,
      label: `Learn: ${payload.title}`,
      payload,
    })),
  );

  return actions;
}

export function isDirectCommand(text: string, capture?: CaptureResult): boolean {
  const lower = text.trim().toLowerCase();
  const commandLike =
    /^(mark|complete|done|finished|reschedule|move|skip|snooze)\b/.test(lower) ||
    /\b(i am done|i'm done|im done|finished it|mark .* done)\b/.test(lower);

  if (!commandLike) return false;
  if (!capture) return true;

  const data = capture.data;
  return (
    data.tasks.length === 0 &&
    data.ideas.length === 0 &&
    data.memoryCandidates.length === 0 &&
    data.peopleUpdates.length === 0 &&
    data.commands.length > 0
  );
}

function shouldSaveThought(rawText: string, capture: CaptureResult): boolean {
  if (rawText.trim().length < 3) return false;
  return !isDirectCommand(rawText, capture);
}

function buildThought(rawText: string, cleanedText: string, capture: CaptureResult): ThoughtPayload {
  const text = `${cleanedText} ${capture.data.summary} ${capture.reflection}`;
  const category = inferThoughtCategory(text);

  return {
    rawText,
    cleanedText,
    summary: summarize(cleanedText, capture.data.summary || capture.reflection),
    category,
    emotionalTone: capture.data.mood || capture.data.healthStatus || inferEmotionalTone(text),
    importance: inferThoughtImportance(category, text),
    relatedPeopleIds: [],
    relatedProjectId: null,
    source: "CAPTURE",
  };
}

function inferLearningItems(text: string, capture: CaptureResult): LearningItemPayload[] {
  const lower = text.toLowerCase();
  const items: LearningItemPayload[] = [];

  const explicit = inferExplicitLearning(text);
  if (explicit) items.push(explicit);

  for (const memory of capture.data.memoryCandidates) {
    const combined = `${memory.title} ${memory.content}`;
    if (!isLearningText(combined)) continue;
    items.push({
      title: titleFromText(memory.title),
      content: memory.content,
      category: inferLearningCategory(combined) ?? "OTHER",
      source: "CAPTURE",
      difficulty: memory.importance === "HIGH" || memory.importance === "PERMANENT" ? "HIGH" : "MEDIUM",
      masteryLevel: "NEW",
      nextReviewAt: dateISO(1),
    });
  }

  if (!explicit && isLearningText(lower)) {
    items.push({
      title: buildLearningTitle(text),
      content: buildLearningContent(text),
      category: inferLearningCategory(lower) ?? "OTHER",
      source: "CAPTURE",
      difficulty: "MEDIUM",
      masteryLevel: "NEW",
      nextReviewAt: dateISO(1),
    });
  }

  return dedupeLearningItems(items).slice(0, 3);
}

function inferExplicitLearning(text: string): LearningItemPayload | null {
  const lower = text.toLowerCase();

  const wordMatch = text.match(/\b(?:learned|learnt|studied)?\s*(?:word|vocab(?:ulary)?)\s+["“”']?([a-zA-Z-]{2,50})["“”']?\s+(?:means|meaning|is|=)\s+(.+)/i);
  if (wordMatch?.[1] && wordMatch[2]) {
    return {
      title: titleFromText(wordMatch[1]),
      content: cleanupSentence(wordMatch[2]),
      category: "VOCABULARY",
      source: "CAPTURE",
      difficulty: "MEDIUM",
      masteryLevel: "NEW",
      nextReviewAt: dateISO(1),
    };
  }

  const lessonMatch = text.match(/\b(public speaking|dance|fitness|finance|business|software|accent)\s+(?:lesson|concept|cue)[:\s-]+(.+)/i);
  if (lessonMatch?.[1] && lessonMatch[2]) {
    const category = inferLearningCategory(lessonMatch[1].toLowerCase()) ?? "OTHER";
    return {
      title: titleFromText(lessonMatch[2]),
      content: cleanupSentence(lessonMatch[2]),
      category,
      source: "CAPTURE",
      difficulty: "MEDIUM",
      masteryLevel: "NEW",
      nextReviewAt: dateISO(1),
    };
  }

  if (lower.includes("today in dance i learned") || lower.includes("in dance i learned")) {
    const content = text.replace(/.*?\bin dance i learned\s+/i, "");
    return {
      title: titleFromText(content.replace(/\band\b.*/i, "")),
      content: cleanupSentence(content),
      category: "DANCE",
      source: "CAPTURE",
      difficulty: "MEDIUM",
      masteryLevel: "NEW",
      nextReviewAt: dateISO(1),
    };
  }

  return null;
}

function inferThoughtCategory(text: string): ThoughtCategory {
  const lower = text.toLowerCase();
  if (/\b(avoid|i think|i feel|realized|pattern|identity|become someone|self)\b/.test(lower)) return "SELF_INSIGHT";
  if (/\b(afraid|fear|scared|anxious|behind|worry)\b/.test(lower)) return "FEAR";
  if (/\b(goal|want to|mission|objective)\b/.test(lower)) return "GOAL";
  if (/\b(met|friend|relationship|sarah|sara|people|person)\b/.test(lower)) return "RELATIONSHIP";
  if (/\b(business|client|startup|invoice|blog site|ai blog)\b/.test(lower)) return "BUSINESS";
  if (/\b(health|sick|sleep|gym|workout|pain)\b/.test(lower)) return "HEALTH";
  if (isLearningText(lower)) return "LEARNING";
  if (/\b(idea|maybe|later|build|create)\b/.test(lower)) return "IDEA";
  if (/\b(noticed|observed|observation)\b/.test(lower)) return "OBSERVATION";
  return "RANDOM";
}

function inferThoughtImportance(category: ThoughtCategory, text: string): ThoughtPayload["importance"] {
  const lower = text.toLowerCase();
  if (/\b(always|never|pattern|important|core|identity|life)\b/.test(lower)) return "HIGH";
  if (category === "SELF_INSIGHT" || category === "GOAL" || category === "LEARNING") return "HIGH";
  if (category === "RANDOM") return "LOW";
  return "MEDIUM";
}

function inferEmotionalTone(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(excited|happy|energized|proud)\b/.test(lower)) return "positive";
  if (/\b(anxious|sad|tired|behind|overwhelmed|avoid)\b/.test(lower)) return "concerned";
  if (/\b(curious|wonder|maybe|think)\b/.test(lower)) return "reflective";
  return null;
}

function inferLearningCategory(text: string): LearningCategory | null {
  const lower = text.toLowerCase();
  if (/\b(vocab|vocabulary|word|definition|means)\b/.test(lower)) return "VOCABULARY";
  if (/\b(dance|bachata|salsa|frame|shoulders|choreo)\b/.test(lower)) return "DANCE";
  if (/\b(public speaking|speech|presentation|pause|stage)\b/.test(lower)) return "PUBLIC_SPEAKING";
  if (/\b(accent|pronunciation|voice)\b/.test(lower)) return "ACCENT";
  if (/\b(software|code|typescript|react|next|database|api)\b/.test(lower)) return "SOFTWARE";
  if (/\b(finance|money|invest|budget)\b/.test(lower)) return "FINANCE";
  if (/\b(fitness|gym|workout|lift|run|cue)\b/.test(lower)) return "FITNESS";
  if (/\b(book|read|chapter)\b/.test(lower)) return "BOOK";
  if (/\b(business|client|sales|startup)\b/.test(lower)) return "BUSINESS";
  return null;
}

function isLearningText(text: string): boolean {
  return /\b(learned|learnt|studied|lesson|concept|cue|book|read|vocab|word|public speaking|dance|course|practice)\b/i.test(text);
}

function summarize(cleanedText: string, fallback: string): string {
  const source = fallback || cleanedText;
  return source.length > 140 ? `${source.slice(0, 137)}…` : source;
}

function buildLearningTitle(text: string): string {
  const cleaned = text
    .replace(/^(today\s+)?(i\s+)?(learned|learnt|studied|read|reviewed)\s+/i, "")
    .replace(/^(that|how to)\s+/i, "")
    .trim();
  return titleFromText(cleaned);
}

function buildLearningContent(text: string): string {
  return cleanupSentence(text.replace(/^(today\s+)?(i\s+)?(learned|learnt|studied|read|reviewed)\s+/i, ""));
}

function titleFromText(text: string): string {
  const cleaned = cleanupSentence(text)
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
  const short = cleaned.length > 70 ? `${cleaned.slice(0, 67)}…` : cleaned;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function cleanupSentence(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).replace(/[.!?]*$/, ".");
}

function dedupeLearningItems(items: LearningItemPayload[]): LearningItemPayload[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.category}:${item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return item.title.trim().length > 0 && item.content.trim().length > 0;
  });
}

function dateISO(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().split("T")[0]!;
}
