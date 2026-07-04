import type { AIProvider } from "./types";
import type {
  CaptureResult,
  TaskOutput,
  IdeaOutput,
  HabitOutput,
} from "./schema";

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

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
}

// ── Extractors ────────────────────────────────────────────────────────────────

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
    const lower = sentence.toLowerCase();
    const isTomorrow = lower.includes("tomorrow");
    const dueDate = isTomorrow ? getTomorrow() : null;

    const triggerMatch = sentence.match(
      /(?:need to|have to|must|should|want to|going to|plan to|will|got to)\s+(.+)/i,
    );

    if (triggerMatch?.[1]) {
      const rest = triggerMatch[1].replace(/[.!?]$/, "");
      for (const part of rest.split(/\s+and\s+/i)) {
        const title = capitalize(part.trim());
        if (title.length < 3 || title.length > 150 || seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());
        tasks.push({ title, description: "", priority: "MEDIUM", dueDate, projectName: null, confidence: "high" });
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
        tasks.push({ title, description: "", priority: "MEDIUM", dueDate, projectName: null, confidence: "medium" });
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

  if (found.length > 0) {
    parts.push(`I found ${found.join(", ")}.`);
  }

  const tomorrowTasks = tasks.filter((t) => t.dueDate === getTomorrow());
  if (tomorrowTasks.length > 0) {
    parts.push(
      `For tomorrow, focus on: ${tomorrowTasks.map((t) => t.title.toLowerCase()).join(" and ")}.`,
    );
  }

  if (healthStatus && habits.some((h) => !h.completed)) {
    parts.push("Rest is the priority — everything else can wait.");
  }

  return parts.join(" ") || "Capture processed. Review what was found below.";
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const mockProvider: AIProvider = {
  async organizeCapture(input: string): Promise<CaptureResult> {
    await new Promise((r) => setTimeout(r, 700)); // simulate latency

    const healthStatus = extractHealthStatus(input);
    const mood = extractMood(input, healthStatus);
    const tasks = extractTasks(input);
    const ideas = extractIdeas(input);
    const habits = extractHabits(input, healthStatus);

    const improveTomorrow = tasks
      .filter((t) => t.dueDate === getTomorrow())
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
    ]
      .filter(Boolean)
      .join(". ");

    return {
      reflection: buildReflection(tasks, ideas, habits, healthStatus, mood),
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
      },
    };
  },
};
