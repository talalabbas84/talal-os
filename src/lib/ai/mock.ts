import type { AIProvider, CaptureOutput, CaptureTask, CaptureIdea, CaptureHabit } from "./types";

const HABIT_NAMES = [
  "dance", "gym", "workout", "yoga", "meditation", "run", "running",
  "walk", "walking", "swim", "swimming", "reading", "journaling",
  "exercise", "stretching", "pilates", "cycling",
];

const MOOD_MAP: Record<string, string> = {
  sick: "Unwell",
  ill: "Unwell",
  tired: "Tired",
  exhausted: "Exhausted",
  happy: "Happy",
  sad: "Sad",
  anxious: "Anxious",
  stressed: "Stressed",
  excited: "Excited",
  good: "Good",
  bad: "Bad",
  great: "Great",
  awful: "Awful",
};

const SKIP_WORDS = ["skip", "skipped", "missed", "didn't", "did not", "couldn't", "could not"];
const HEALTH_WORDS = ["sick", "ill", "fever", "headache", "tired", "exhausted", "unwell", "not feeling well", "under the weather"];

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|[\n]+/).filter((s) => s.trim().length > 0);
}

function extractHealthStatus(text: string): string | undefined {
  const lower = text.toLowerCase();
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    const sl = sentence.toLowerCase();
    if (HEALTH_WORDS.some((w) => sl.includes(w))) {
      // Return a cleaned-up version of the relevant part
      const match = sentence.match(/(?:feel|feeling|am|i'm|i am)\s+([^.,!?]+)/i);
      if (match?.[1]) return capitalize(match[1].trim().replace(/[.,!?]$/, ""));
      // Fallback: just note the health keyword
      const keyword = HEALTH_WORDS.find((w) => sl.includes(w));
      if (keyword) return capitalize(keyword);
    }
  }

  return undefined;
}

function extractMood(text: string, healthStatus?: string): string | undefined {
  if (healthStatus) return "Unwell";
  const lower = text.toLowerCase();
  for (const [word, mood] of Object.entries(MOOD_MAP)) {
    if (lower.includes(word)) return mood;
  }
  return undefined;
}

function extractTasks(text: string): CaptureTask[] {
  const sentences = splitSentences(text);
  const tasks: CaptureTask[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const isTomorrow = lower.includes("tomorrow");
    const dueDate = isTomorrow ? getTomorrow() : null;

    // "need to X and Y", "have to X", "should X", etc.
    const triggerMatch = sentence.match(
      /(?:need to|have to|must|should|want to|going to|plan to|will|got to)\s+(.+)/i,
    );

    if (triggerMatch?.[1]) {
      const rest = triggerMatch[1].replace(/[.!?]$/, "");
      const parts = rest.split(/\s+and\s+/i);
      for (const part of parts) {
        const title = capitalize(part.trim());
        if (title.length < 3 || title.length > 150) continue;
        const key = title.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tasks.push({ title, description: "", priority: "MEDIUM", dueDate, projectName: null });
      }
      continue;
    }

    // Direct imperative: "Buy groceries", "Call doctor"
    const imperativeMatch = sentence
      .trim()
      .match(
        /^(?:also\s+)?(?:buy|call|email|send|write|finish|complete|fix|check|update|schedule|book|make|prepare|review|submit|pick up)\s+(.+)/i,
      );
    if (imperativeMatch?.[0]) {
      const title = capitalize(imperativeMatch[0].replace(/[.!?]$/, "").trim());
      const key = title.toLowerCase();
      if (title.length >= 3 && title.length <= 150 && !seen.has(key)) {
        seen.add(key);
        tasks.push({ title, description: "", priority: "MEDIUM", dueDate, projectName: null });
      }
    }
  }

  return tasks;
}

function extractIdeas(text: string): CaptureIdea[] {
  const patterns = [
    /idea for\s+an?\s+(.+?)(?:[.,!?]|$)/gi,
    /idea for\s+(.+?)(?:[.,!?]|$)/gi,
    /idea about\s+(.+?)(?:[.,!?]|$)/gi,
    /thinking (?:about|of) (?:building|creating|making)\s+(.+?)(?:[.,!?]|$)/gi,
    /want to (?:build|create|make)\s+an?\s+(.+?)(?:[.,!?]|$)/gi,
    /want to (?:build|create|make)\s+(.+?)(?:[.,!?]|$)/gi,
  ];

  const ideas: CaptureIdea[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const raw = (m[1] ?? "").replace(/[.,!?]$/, "").trim();
      const title = capitalize(raw);
      if (title.length < 3 || seen.has(title.toLowerCase())) continue;
      seen.add(title.toLowerCase());
      const category = inferIdeaCategory(title);
      ideas.push({ title, description: "", category });
    }
  }

  return ideas;
}

function inferIdeaCategory(title: string): string {
  const lower = title.toLowerCase();
  if (/app|website|platform|software|tool|saas|ai|ml/.test(lower)) return "Business";
  if (/health|fitness|exercise|wellness/.test(lower)) return "Health";
  if (/learn|study|course|book/.test(lower)) return "Learning";
  if (/dance|music|art|creative/.test(lower)) return "Personal";
  return "Business";
}

function extractHabits(text: string, healthStatus?: string): CaptureHabit[] {
  const sentences = splitSentences(text);
  const habits: CaptureHabit[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const habitName of HABIT_NAMES) {
      if (!lower.includes(habitName)) continue;
      if (seen.has(habitName)) continue;

      const skipped = SKIP_WORDS.some((w) => lower.includes(w));
      let note = "";
      if (skipped && healthStatus) {
        note = `Skipped because: ${healthStatus.toLowerCase()}`;
      } else if (skipped) {
        note = "Skipped today";
      }

      seen.add(habitName);
      habits.push({ name: capitalize(habitName), completed: !skipped, note });
    }
  }

  return habits;
}

function buildSummary(
  tasks: CaptureTask[],
  ideas: CaptureIdea[],
  habits: CaptureHabit[],
  healthStatus?: string,
): string {
  const parts: string[] = [];
  if (healthStatus) parts.push("Health update noted");
  if (tasks.length > 0) parts.push(`${tasks.length} task${tasks.length !== 1 ? "s" : ""} identified`);
  if (ideas.length > 0) parts.push(`${ideas.length} idea${ideas.length !== 1 ? "s" : ""} captured`);
  if (habits.length > 0) parts.push(`${habits.length} habit${habits.length !== 1 ? "s" : ""} tracked`);
  return parts.length > 0 ? parts.join(". ") + "." : "Capture processed.";
}

export const mockProvider: AIProvider = {
  async processCapture(text: string): Promise<CaptureOutput> {
    // Simulate a brief processing delay
    await new Promise((r) => setTimeout(r, 600));

    const healthStatus = extractHealthStatus(text);
    const mood = extractMood(text, healthStatus);
    const tasks = extractTasks(text);
    const ideas = extractIdeas(text);
    const habits = extractHabits(text, healthStatus);

    const improveTomorrow = tasks
      .filter((t) => t.dueDate === getTomorrow())
      .map((t) => t.title)
      .join(", ");

    const journal = {
      accomplished: "",
      distractedBy: "",
      improveTomorrow,
      feeling: healthStatus ? `Sick and resting` : mood ?? "",
    };

    return {
      summary: buildSummary(tasks, ideas, habits, healthStatus),
      mood,
      healthStatus,
      tasks,
      ideas,
      journal,
      habits,
      projects: [],
    };
  },
};
