import type { AIProvider } from "./types";
import type { CaptureResult, TaskOutput, IdeaOutput, HabitOutput, MemoryCandidateOutput } from "./schema";

// ── Constants ─────────────────────────────────────────────────────────────────

const HABIT_NAMES = [
  "dance", "gym", "workout", "yoga", "meditation",
  "run", "running", "walk", "walking", "swim", "swimming",
  "reading", "journaling", "exercise", "stretching", "pilates", "cycling",
];

const SKIP_WORDS = ["skip", "skipped", "missed", "didn't", "did not", "couldn't", "could not"];
const HEALTH_WORDS = ["sick", "ill", "fever", "headache", "tired", "exhausted", "unwell", "not feeling well"];

const MOOD_MAP: Record<string, string> = {
  sick: "Unwell", ill: "Unwell", tired: "Tired", exhausted: "Exhausted",
  happy: "Happy", sad: "Sad", anxious: "Anxious", stressed: "Stressed",
  excited: "Excited", good: "Good", bad: "Bad", great: "Great", awful: "Awful",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function dateISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0]!;
}

function nextWeekday(day: number): string {
  // day: 0=Sun … 6=Sat
  const d = new Date();
  const diff = ((day - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0]!;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

// ── Time extraction ───────────────────────────────────────────────────────────

interface TimeInfo {
  dueDate: string | null;
  dueTime: string | null;
  timeContext: string | null;
  needsReminder: boolean;
}

function extractTimeInfo(sentence: string): TimeInfo {
  const l = sentence.toLowerCase();

  let dueDate: string | null = null;
  let dueTime: string | null = null;
  let timeContext: string | null = null;
  let needsReminder = false;

  // Reminder signals
  if (/remind me|don't forget|before |after work/.test(l)) needsReminder = true;

  // Time of day
  if (/\bmorning\b/.test(l)) dueTime = "morning";
  else if (/\bafternoon\b/.test(l)) dueTime = "afternoon";
  else if (/\bevening\b|\btonight\b/.test(l)) dueTime = "evening";
  else if (/\bnight\b/.test(l)) dueTime = "night";

  // Special contexts (before_X / after_X)
  const beforeMatch = l.match(/before\s+(dance|gym|class|work|lunch|dinner|meeting)/);
  if (beforeMatch) {
    timeContext = `before_${beforeMatch[1]}`;
    needsReminder = true;
  }
  if (/after\s+work/.test(l)) {
    timeContext = "after_work";
    needsReminder = true;
  }

  // Dates
  if (/\btonight\b/.test(l)) {
    dueDate = dateISO(0);
    timeContext = timeContext ?? "tonight";
  } else if (/\btoday\b|\bthis morning\b|\bthis afternoon\b|\bthis evening\b/.test(l)) {
    dueDate = dateISO(0);
  } else if (/\btomorrow\b/.test(l)) {
    dueDate = dateISO(1);
  } else if (/this weekend|weekend/.test(l)) {
    dueDate = nextWeekday(6); // Saturday
    timeContext = timeContext ?? "this_weekend";
  } else if (/next monday|monday/.test(l)) dueDate = nextWeekday(1);
  else if (/next tuesday|tuesday/.test(l)) dueDate = nextWeekday(2);
  else if (/next wednesday|wednesday/.test(l)) dueDate = nextWeekday(3);
  else if (/next thursday|thursday/.test(l)) dueDate = nextWeekday(4);
  else if (/next friday|friday/.test(l)) dueDate = nextWeekday(5);

  return { dueDate, dueTime, timeContext, needsReminder };
}

// ── Priority extraction ───────────────────────────────────────────────────────

type Level = "LOW" | "MEDIUM" | "HIGH";

interface PriorityInfo {
  urgency: Level;
  importance: Level;
  energyRequired: Level;
}

function extractPriority(sentence: string, timeInfo: TimeInfo): PriorityInfo {
  const l = sentence.toLowerCase();

  // Urgency
  let urgency: Level = "MEDIUM";
  if (/urgent|asap|immediately|right now|tonight|today/.test(l) || timeInfo.dueDate === dateISO(0)) {
    urgency = "HIGH";
  } else if (/someday|eventually|whenever|no rush|low priority/.test(l)) {
    urgency = "LOW";
  }

  // Importance
  let importance: Level = "MEDIUM";
  if (/important|critical|must|have to|need to|required|essential/.test(l)) {
    importance = "HIGH";
  } else if (/maybe|possibly|might|could|idea|thinking/.test(l)) {
    importance = "LOW";
  }

  // Energy required
  let energyRequired: Level = "MEDIUM";
  if (/\bquick\b|\beasy\b|\bjust\b|\bsimple\b|\bsmall\b|\bcall\b|\btext\b|\bbuy\b/.test(l)) {
    energyRequired = "LOW";
  } else if (/\bbig\b|\bcomplex\b|\bhard\b|\bdifficult\b|\bmajor\b|\bproject\b/.test(l)) {
    energyRequired = "HIGH";
  }

  return { urgency, importance, energyRequired };
}

// ── Memory candidate extraction ───────────────────────────────────────────────

type MemoryType =
  | "IDENTITY" | "LIFE_PRINCIPLE" | "PRODUCT_DECISION" | "PRODUCT_CONTEXT"
  | "LESSON_LEARNED" | "CURRENT_STATE" | "RELATIONSHIP_INSIGHT" | "HEALTH_INSIGHT"
  | "FINANCE_INSIGHT" | "BUSINESS_IDEA" | "PERSONAL_PATTERN";

type MemoryImportance = "LOW" | "MEDIUM" | "HIGH" | "PERMANENT";

interface MemoryPattern {
  regex: RegExp;
  type: MemoryType;
  importance: MemoryImportance;
  reason: string;
}

const MEMORY_PATTERNS: MemoryPattern[] = [
  {
    regex: /i\s+(?:don'?t|do not|didn'?t|did not)\s+actually\b/i,
    type: "IDENTITY",
    importance: "PERMANENT",
    reason: "Correcting a self-perception — this is a core identity insight.",
  },
  {
    regex: /i(?:'m|\s+am)\s+someone\s+who\b/i,
    type: "IDENTITY",
    importance: "HIGH",
    reason: "Explicit identity statement about who Talal is.",
  },
  {
    regex: /the\s+thing\s+about\s+me\s+is\b/i,
    type: "IDENTITY",
    importance: "HIGH",
    reason: "Self-insight about personal nature.",
  },
  {
    regex: /my\s+(?:rule|principle|philosophy|approach|belief)\s+is\b/i,
    type: "LIFE_PRINCIPLE",
    importance: "PERMANENT",
    reason: "Explicit life principle or personal rule.",
  },
  {
    regex: /i\s+believe\s+(?:that\s+)?(?:the\s+)?(?:most\s+)?important\b/i,
    type: "LIFE_PRINCIPLE",
    importance: "HIGH",
    reason: "Statement of what the user values most.",
  },
  {
    regex: /i\s+(?:realized|realised)\b/i,
    type: "LESSON_LEARNED",
    importance: "HIGH",
    reason: "An explicit realization — often a lesson worth keeping.",
  },
  {
    regex: /i(?:'ve|\s+have)\s+(?:learned|learnt)\b/i,
    type: "LESSON_LEARNED",
    importance: "MEDIUM",
    reason: "An explicit learning the user articulated.",
  },
  {
    regex: /i\s+noticed\s+(?:that\s+)?i\b/i,
    type: "PERSONAL_PATTERN",
    importance: "MEDIUM",
    reason: "Self-observation about a recurring personal pattern.",
  },
  {
    regex: /i\s+(?:always|never)\s+(?!skip|miss|forget)/i,
    type: "PERSONAL_PATTERN",
    importance: "MEDIUM",
    reason: "Always/never statement — habitual behavior pattern.",
  },
  {
    regex: /i\s+tend\s+to\b/i,
    type: "PERSONAL_PATTERN",
    importance: "MEDIUM",
    reason: "Recurring behavior tendency.",
  },
  {
    regex: /i(?:'ve|\s+have)\s+come\s+to\s+(?:understand|realize|know|see)\b/i,
    type: "LESSON_LEARNED",
    importance: "HIGH",
    reason: "Evolved understanding — insight that developed over time.",
  },
  {
    regex: /i\s+(?:keep|kept)\s+(?:coming\s+back|returning)\b/i,
    type: "PERSONAL_PATTERN",
    importance: "HIGH",
    reason: "Pattern of returning — shows persistence or unresolved pull.",
  },
];

function extractMemoryCandidates(text: string): MemoryCandidateOutput[] {
  const candidates: MemoryCandidateOutput[] = [];
  const seen = new Set<string>();
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    if (sentence.length < 15 || sentence.length > 400) continue;

    for (const pattern of MEMORY_PATTERNS) {
      if (!pattern.regex.test(sentence)) continue;

      const content = sentence.replace(/[.!?]+$/, "").trim();
      const key = content.toLowerCase().slice(0, 60);
      if (seen.has(key)) break;
      seen.add(key);

      // Build a short title from the sentence
      const title = content.length > 70
        ? capitalize(content.slice(0, 67)) + "…"
        : capitalize(content);

      candidates.push({
        title,
        content: capitalize(content),
        type: pattern.type,
        importance: pattern.importance,
        reason: pattern.reason,
      });
      break; // one pattern match per sentence
    }
  }

  return candidates;
}

// ── Field extractors ──────────────────────────────────────────────────────────

function extractHealthStatus(text: string): string | undefined {
  for (const sentence of splitSentences(text)) {
    const sl = sentence.toLowerCase();
    if (!HEALTH_WORDS.some((w) => sl.includes(w))) continue;
    const match = sentence.match(/(?:feel|feeling|am|i'm|i am)\s+([^.,!?]+)/i);
    if (match?.[1]) return capitalize(match[1].trim().replace(/[.,!?]$/, ""));
    const kw = HEALTH_WORDS.find((w) => sl.includes(w));
    if (kw) return capitalize(kw);
  }
  return undefined;
}

function extractMood(text: string, health?: string): string | undefined {
  if (health) return "Unwell";
  const lower = text.toLowerCase();
  for (const [word, mood] of Object.entries(MOOD_MAP)) {
    if (lower.includes(word)) return mood;
  }
  return undefined;
}

function extractTasks(text: string): TaskOutput[] {
  const sentences = splitSentences(text);
  const tasks: TaskOutput[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const timeInfo = extractTimeInfo(sentence);

    const triggerMatch = sentence.match(
      /(?:need to|have to|must|should|want to|going to|plan to|will|got to)\s+(.+)/i,
    );

    if (triggerMatch?.[1]) {
      const rest = triggerMatch[1].replace(/[.!?]$/, "");
      for (const part of rest.split(/\s+and\s+/i)) {
        const title = capitalize(part.trim());
        if (title.length < 3 || title.length > 150 || seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());
        const priority = extractPriority(sentence, timeInfo);
        tasks.push({
          title,
          description: "",
          priority: "MEDIUM",
          ...timeInfo,
          ...priority,
          projectName: null,
          confidence: "high",
        });
      }
      continue;
    }

    const directMatch = sentence.trim().match(
      /^(?:also\s+)?(?:buy|call|email|send|write|finish|complete|fix|check|update|schedule|book|make|prepare|review|submit|pick up)\s+(.+)/i,
    );
    if (directMatch?.[0]) {
      const title = capitalize(directMatch[0].replace(/[.!?]$/, "").trim());
      const key = title.toLowerCase();
      if (title.length >= 3 && title.length <= 150 && !seen.has(key)) {
        seen.add(key);
        const priority = extractPriority(sentence, timeInfo);
        tasks.push({
          title,
          description: "",
          priority: "MEDIUM",
          ...timeInfo,
          ...priority,
          projectName: null,
          confidence: "medium",
        });
      }
    }
  }

  return tasks;
}

function extractIdeas(text: string): IdeaOutput[] {
  const patterns = [
    /idea for\s+an?\s+(.+?)(?:[.,!?]|$)/gi,
    /idea for\s+(.+?)(?:[.,!?]|$)/gi,
    /idea about\s+(.+?)(?:[.,!?]|$)/gi,
    /thinking (?:about|of) (?:building|creating|making)\s+(.+?)(?:[.,!?]|$)/gi,
    /want to (?:build|create|make)\s+an?\s+(.+?)(?:[.,!?]|$)/gi,
    /want to (?:build|create|make)\s+(.+?)(?:[.,!?]|$)/gi,
  ];

  const ideas: IdeaOutput[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const title = capitalize((m[1] ?? "").replace(/[.,!?]$/, "").trim());
      if (title.length < 3 || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      const lower = title.toLowerCase();
      const category =
        /app|website|platform|software|tool|saas|ai|ml/.test(lower) ? "Business" :
        /health|fitness|wellness/.test(lower) ? "Health" :
        /learn|study|course|book/.test(lower) ? "Learning" : "Business";
      ideas.push({ title, description: "", category, confidence: "medium" });
    }
  }

  return ideas;
}

function extractHabits(text: string, healthStatus?: string): HabitOutput[] {
  const habits: HabitOutput[] = [];
  const seen = new Set<string>();

  for (const sentence of splitSentences(text)) {
    const lower = sentence.toLowerCase();
    for (const habitName of HABIT_NAMES) {
      if (!lower.includes(habitName) || seen.has(habitName)) continue;
      const skipped = SKIP_WORDS.some((w) => lower.includes(w));
      const note = skipped
        ? healthStatus ? `Skipped because: ${healthStatus.toLowerCase()}` : "Skipped today"
        : "";
      seen.add(habitName);
      habits.push({ name: capitalize(habitName), completed: !skipped, note, confidence: "high" });
    }
  }

  return habits;
}

function buildReflection(
  tasks: TaskOutput[],
  ideas: IdeaOutput[],
  habits: HabitOutput[],
  memories: MemoryCandidateOutput[],
  healthStatus?: string,
  mood?: string,
): string {
  const parts: string[] = [];

  if (healthStatus) {
    parts.push(`Sounds like today has been tough — ${healthStatus.toLowerCase()}.`);
  } else if (mood) {
    parts.push(`Feeling ${mood.toLowerCase()} today.`);
  }

  const found: string[] = [];
  if (tasks.length > 0) found.push(`${tasks.length} task${tasks.length !== 1 ? "s" : ""}`);
  if (ideas.length > 0) found.push(`${ideas.length} idea${ideas.length !== 1 ? "s" : ""}`);
  if (habits.length > 0) found.push(`${habits.length} habit${habits.length !== 1 ? "s" : ""}`);
  if (memories.length > 0) found.push(`${memories.length} memory insight${memories.length !== 1 ? "s" : ""}`);
  if (found.length > 0) parts.push(`I found ${found.join(", ")}.`);

  const urgentToday = tasks.filter((t) => t.dueDate === dateISO(0) || t.urgency === "HIGH");
  if (urgentToday.length > 0) {
    parts.push(`Focus on ${urgentToday.map((t) => t.title.toLowerCase()).slice(0, 2).join(" and ")} first.`);
  }

  const tomorrowTasks = tasks.filter((t) => t.dueDate === dateISO(1));
  if (tomorrowTasks.length > 0 && urgentToday.length === 0) {
    parts.push(`For tomorrow: ${tomorrowTasks.map((t) => t.title.toLowerCase()).join(" and ")}.`);
  }

  if (healthStatus && habits.some((h) => !h.completed)) {
    parts.push("Rest is the priority — everything else can wait.");
  }

  return parts.join(" ") || "Capture processed.";
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const mockProvider: AIProvider = {
  async organizeCapture(input: string): Promise<CaptureResult> {
    await new Promise((r) => setTimeout(r, 600));

    const healthStatus = extractHealthStatus(input);
    const mood = extractMood(input, healthStatus);
    const tasks = extractTasks(input);
    const ideas = extractIdeas(input);
    const habits = extractHabits(input, healthStatus);
    const memoryCandidates = extractMemoryCandidates(input);

    const improveTomorrow = tasks
      .filter((t) => t.dueDate === dateISO(1))
      .map((t) => t.title)
      .join(", ");

    const journal = {
      accomplished: "",
      distractedBy: "",
      improveTomorrow,
      feeling: healthStatus ? "Sick and resting" : mood ?? "",
    };

    const summary = [
      healthStatus && "Health update noted",
      tasks.length > 0 && `${tasks.length} task${tasks.length !== 1 ? "s" : ""} identified`,
      ideas.length > 0 && `${ideas.length} idea${ideas.length !== 1 ? "s" : ""} captured`,
      habits.length > 0 && `${habits.length} habit${habits.length !== 1 ? "s" : ""} tracked`,
      memoryCandidates.length > 0 && `${memoryCandidates.length} memory insight${memoryCandidates.length !== 1 ? "s" : ""} detected`,
    ].filter(Boolean).join(". ");

    return {
      reflection: buildReflection(tasks, ideas, habits, memoryCandidates, healthStatus, mood),
      data: {
        summary: summary || "Capture processed.",
        mood,
        healthStatus,
        tasks,
        ideas,
        journal,
        habits,
        projects: [],
        reminders: [],
        memoryCandidates,
      },
    };
  },
};
