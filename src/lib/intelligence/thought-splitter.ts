import type {
  ActivityCategory,
  ActivityLogPayload,
  PlannedAction,
  ThoughtUnitPayload,
  ThoughtUnitType,
} from "./types";

export interface SplitThoughtUnit {
  rawText: string;
  cleanedText: string;
  type: ThoughtUnitType;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  routedTo: string | null;
}

let _seq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++_seq}`;
}

export function splitThoughts(rawCapture: string): SplitThoughtUnit[] {
  const segments = splitRawCapture(rawCapture);

  return segments.map((rawText) => {
    const type = classifyThoughtUnit(rawText);
    const cleanedText = cleanThoughtUnit(rawText, type);
    return {
      rawText,
      cleanedText,
      type,
      confidence: confidenceForUnit(rawText, type),
      routedTo: routedTo(type),
    };
  });
}

export function planFromThoughtUnits(units: SplitThoughtUnit[]): PlannedAction[] {
  const actions: PlannedAction[] = [];

  for (const unit of units) {
    const payload: ThoughtUnitPayload = {
      rawText: unit.rawText,
      cleanedText: unit.cleanedText,
      type: unit.type,
      confidence: unit.confidence,
      sourceCaptureId: null,
      routedTo: unit.routedTo,
    };

    actions.push({
      id: nextId("unit"),
      type: "CREATE_THOUGHT_UNIT",
      label: `Unit: ${unit.cleanedText}`,
      payload,
    });

    const activityPayload = activityFromUnit(unit);
    if (activityPayload) {
      actions.push({
        id: nextId("activity"),
        type: "CREATE_ACTIVITY_LOG",
        label: `Activity: ${activityPayload.activity}`,
        payload: activityPayload,
      });
    }
  }

  return actions;
}

function splitRawCapture(rawCapture: string): string[] {
  const normalized = rawCapture
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s+\|\s+/g, ". ")
    .trim();

  if (!normalized) return [];

  const firstPass = normalized
    .split(/\n+|(?<=[.!?])\s+|\s+(?:also|and also|plus)\s+/i)
    .flatMap((segment) => splitCommaUnits(segment))
    .map((segment) => segment.trim().replace(/^[,.\s]+|[,.\s]+$/g, ""))
    .filter(Boolean);

  return firstPass.length > 0 ? firstPass : [normalized];
}

function splitCommaUnits(segment: string): string[] {
  const parts = segment.split(/\s*,\s*/).filter(Boolean);
  if (parts.length <= 1) return [segment];

  const signalCount = parts.filter(hasUnitSignal).length;
  return signalCount >= 2 ? parts : [segment];
}

function hasUnitSignal(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(working|watching|going|coding|commuting|procrastinating|need|groceries|remind|sarah|sara|birthday|learned|word|feeling|tired|sick|gym|dance|idea|done|finished|read|book|high and|eating)\b/.test(lower);
}

function classifyThoughtUnit(text: string): ThoughtUnitType {
  const lower = text.toLowerCase();
  if (/\b(remind me|reminder|tonight|tomorrow)\b/.test(lower) && /\b(remind|stretch|call|text|ask)\b/.test(lower)) return "REMINDER";
  if (/\b(learned|learnt|word|vocab|lesson|read|book|course|concept)\b/.test(lower)) return "LEARNING";
  if (/\b(sarah|sara|birthday|said|met|talked|friend|mom|dad)\b/.test(lower)) return "PEOPLE";
  if (/\b(gym done|workout done|meditated|habit|finished gym|completed gym)\b/.test(lower)) return "HABIT";
  if (/\b(working on|watching|going to|coding|commuting|procrastinating|dance class|eating|currently|right now|rn)\b/.test(lower)) return "ACTIVITY";
  if (/\b(feeling|feel|tired|sick|sad|happy|anxious|overwhelmed|high)\b/.test(lower)) return "MOOD";
  if (/\b(need|todo|to do|buy|groceries|should|have to|must)\b/.test(lower)) return "TASK";
  if (/\b(today was|what went well|difficult|learned about myself)\b/.test(lower)) return "JOURNAL";
  if (/\b(idea|maybe build|blog site|startup)\b/.test(lower)) return "IDEA";
  if (/\b(remember|memory|insight|realized|pattern)\b/.test(lower)) return "MEMORY";
  if (/\b(should i|decide|decision|choose)\b/.test(lower)) return "DECISION";
  return "RANDOM";
}

function cleanThoughtUnit(text: string, type: ThoughtUnitType): string {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (/\bgym done\b/.test(lower)) return "I completed gym.";
  if (/^feeling\b/i.test(trimmed)) return `I am ${trimmed.toLowerCase()}.`;
  if (/\bgroceries tomorrow\b/i.test(trimmed)) return "I need to buy groceries tomorrow.";
  if (/\b(sarah|sara) birthday june ?5\b/i.test(trimmed)) return "Sarah's birthday is June 5.";
  if (/^learned word\b/i.test(trimmed)) return `I learned the word ${trimmed.replace(/^learned word\s+/i, "")}.`;
  if (/^remind me\b/i.test(trimmed)) return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;

  if (type === "ACTIVITY" && !/^i\b/i.test(trimmed)) return `I am ${trimmed.replace(/\brn\b/i, "right now")}.`;
  if (type === "TASK" && !/^i\b/i.test(trimmed)) return `I need to ${trimmed}.`;
  if (type === "MOOD" && !/^i\b/i.test(trimmed)) return `I am ${trimmed}.`;

  return trimmed.endsWith(".") || trimmed.endsWith("?") || trimmed.endsWith("!") ? trimmed : `${trimmed}.`;
}

function confidenceForUnit(text: string, type: ThoughtUnitType): "LOW" | "MEDIUM" | "HIGH" {
  if (type === "RANDOM") return "LOW";
  if (hasUnitSignal(text)) return "HIGH";
  return "MEDIUM";
}

function routedTo(type: ThoughtUnitType): string | null {
  switch (type) {
    case "ACTIVITY":
      return "ACTIVITY_LOG";
    case "TASK":
      return "TASK";
    case "REMINDER":
      return "REMINDER";
    case "PEOPLE":
      return "PEOPLE";
    case "LEARNING":
      return "LEARNING_ITEM";
    case "MOOD":
    case "JOURNAL":
      return "DAILY_LOG";
    case "HABIT":
      return "HABIT";
    case "IDEA":
      return "INBOX";
    case "MEMORY":
      return "MEMORY";
    case "DECISION":
      return "DECISION";
    default:
      return null;
  }
}

function activityFromUnit(unit: SplitThoughtUnit): ActivityLogPayload | null {
  if (unit.type !== "ACTIVITY") return null;

  return {
    activity: unit.cleanedText.replace(/^I am\s+/i, "").replace(/[.!?]$/g, ""),
    category: inferActivityCategory(unit.cleanedText),
    startedAt: null,
    endedAt: null,
    energyLevel: inferEnergy(unit.cleanedText),
    mood: inferMood(unit.cleanedText),
    notes: unit.rawText,
    sourceCaptureId: null,
  };
}

function inferActivityCategory(text: string): ActivityCategory {
  const lower = text.toLowerCase();
  if (lower.includes("talal os")) return "TALAL_OS";
  if (/\b(work|working|coding|crm|bug)\b/.test(lower)) return "WORK";
  if (/\b(gym|fitness|workout|run)\b/.test(lower)) return "FITNESS";
  if (/\b(dance|bachata|salsa)\b/.test(lower)) return "DANCE";
  if (/\b(eating|pizza|food|lunch|dinner)\b/.test(lower)) return "FOOD";
  if (/\b(netflix|rest|sleep|relax)\b/.test(lower)) return "REST";
  if (/\b(friend|social|sarah|sara)\b/.test(lower)) return "SOCIAL";
  if (/\b(learn|reading|study|course)\b/.test(lower)) return "LEARNING";
  if (/\b(procrastinating|scrolling)\b/.test(lower)) return "PROCRASTINATION";
  if (/\b(sick|recovery|tired)\b/.test(lower)) return "RECOVERY";
  if (/\b(groceries|errand|commuting)\b/.test(lower)) return "ERRAND";
  return "OTHER";
}

function inferEnergy(text: string): "LOW" | "MEDIUM" | "HIGH" | null {
  const lower = text.toLowerCase();
  if (/\b(tired|sick|low energy|drained)\b/.test(lower)) return "LOW";
  if (/\b(energized|locked in|great)\b/.test(lower)) return "HIGH";
  return null;
}

function inferMood(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(tired|sick|high|procrastinating|focused|happy|sad|anxious)\b/.test(lower)) {
    return lower.match(/\b(tired|sick|high|procrastinating|focused|happy|sad|anxious)\b/)?.[0] ?? null;
  }
  return null;
}
