import type { AIProvider } from "./types";
import type {
  CaptureResult,
  TaskOutput,
  IdeaOutput,
  HabitOutput,
  MemoryCandidateOutput,
  CommandOutput,
  EventPlaceholderOutput,
  IntentResultOutput,
  RecommendationOutput,
  ReflectionResultOutput,
  PersonUpdateOutput,
  PersonInsightItemOutput,
} from "./schema";
import type { Intent } from "@/lib/intelligence/types";

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

function extractEventPlaceholders(text: string): EventPlaceholderOutput[] {
  if (!/\b(dinner|lunch|coffee|meeting|meet|plan|class|appointment|call|date)\b/i.test(text)) return [];
  const timeInfo = extractTimeInfo(text);
  if (!timeInfo.dueDate) return [];

  const personName = text.match(/\bwith\s+([A-Z][a-z]{1,30})\b/)?.[1] ?? null;
  const kind =
    /\bdinner\b/i.test(text) ? "Dinner" :
    /\blunch\b/i.test(text) ? "Lunch" :
    /\bcoffee\b/i.test(text) ? "Coffee" :
    /\bdance class\b/i.test(text) ? "Dance class" :
    /\bclass\b/i.test(text) ? "Class" :
    /\bmeeting\b/i.test(text) ? "Meeting" :
    /\bcall\b/i.test(text) ? "Call" :
    /\bappointment\b/i.test(text) ? "Appointment" :
    /\bdate\b/i.test(text) ? "Date" :
    "Plan";
  const relatedPersonName = personName && !EXCLUDED_NAMES.has(personName) ? personName : null;
  const title = relatedPersonName ? `${kind} with ${relatedPersonName}` : kind;
  const timeMatch = text.match(/\b(?:at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let time = timeInfo.dueTime;

  if (timeMatch?.[1]) {
    let hour = Number(timeMatch[1]);
    const minute = timeMatch[2] ?? "00";
    const suffix = timeMatch[3]?.toLowerCase();
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (!suffix && hour >= 1 && hour <= 7 && /\b(dinner|evening|night|after.+dance)\b/i.test(text)) hour += 12;
    time = `${hour.toString().padStart(2, "0")}:${minute}`;
  }

  return [{
    title,
    description: /\bafter\b/i.test(text) ? "Includes after-context from capture." : "",
    date: timeInfo.dueDate,
    time,
    timeContext: timeInfo.timeContext ?? extractAfterContext(text),
    location: null,
    relatedPersonName,
    needsReminder: true,
    confidence: "high",
  }];
}

function extractAfterContext(text: string): string | null {
  const after = text.match(/\bafter\s+(?:my\s+)?([^,.!?]+?)(?:\s+at\s+|\s+around\s+|[,.!?]|$)/i)?.[1]?.trim();
  return after ? `after ${after}` : null;
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
      if (!isExplicitHabitUpdate(lower, habitName)) continue;
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

function isExplicitHabitUpdate(sentence: string, habitName: string): boolean {
  const escapedHabit = habitName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const completedBefore = new RegExp(`\\b(?:finished|completed|did|done with|went to|attended)\\s+(?:my\\s+|the\\s+)?${escapedHabit}\\b`, "i");
  const completedAfter = new RegExp(`\\b${escapedHabit}\\s+(?:done|completed|finished)\\b`, "i");
  const skipped = new RegExp(`\\b(?:skip|skipped|not today|missed|couldn'?t go to|didn'?t go to)\\b.*\\b${escapedHabit}\\b|\\b${escapedHabit}\\b.*\\b(?:skip|skipped|not today|missed)\\b`, "i");

  return completedBefore.test(sentence) || completedAfter.test(sentence) || skipped.test(sentence);
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

// ── Command extraction ────────────────────────────────────────────────────────

function extractCommands(text: string): CommandOutput[] {
  const commands: CommandOutput[] = [];
  const seen = new Set<string>();

  for (const sentence of splitSentences(text)) {
    const lower = sentence.toLowerCase();

    // "I finished X" / "I've finished X" / "I completed X" / "I did X" / "done with X"
    // Only for non-habit items (habits are handled by extractHabits)
    const finishedMatch = sentence.match(
      /(?:i(?:'ve)?\s+(?:finished|completed|done)|done with)\s+(?:the\s+)?(.+?)(?:[.!?]|$)/i,
    );
    if (finishedMatch?.[1]) {
      const target = finishedMatch[1].replace(/[.!?]$/, "").trim();
      const isKnownHabit = HABIT_NAMES.some((h) => target.toLowerCase() === h);
      if (!isKnownHabit && !seen.has(target.toLowerCase()) && target.length > 2) {
        seen.add(target.toLowerCase());
        commands.push({ type: "COMPLETE_TASK", target, details: null, confidence: "high" });
      }
    }

    // "Mark X as done" / "Mark X done"
    const markMatch = sentence.match(/mark\s+(.+?)\s+(?:as\s+)?done/i);
    if (markMatch?.[1]) {
      const target = markMatch[1].trim();
      if (!seen.has(target.toLowerCase()) && target.length > 2) {
        seen.add(target.toLowerCase());
        commands.push({ type: "COMPLETE_TASK", target, details: null, confidence: "high" });
      }
    }

    // "Move X to Y" / "Postpone X to Y" / "Reschedule X to Y" / "Push X to Y"
    const moveMatch = sentence.match(
      /(?:move|postpone|reschedule|delay|push)\s+(.+?)\s+to\s+(.+?)(?:[.!?]|$)/i,
    );
    if (moveMatch?.[1] && moveMatch?.[2]) {
      const target = moveMatch[1].trim();
      const details = moveMatch[2].trim();
      if (!seen.has(target.toLowerCase()) && target.length > 2) {
        seen.add(target.toLowerCase());
        commands.push({ type: "RESCHEDULE_TASK", target, details, confidence: "high" });
      }
    }

    // "Remind me to X" / "Remind me tonight to X"
    const remindMatch = sentence.match(
      /remind\s+me\s+(?:(?:tonight|tomorrow|today|this\s+\w+)\s+)?to\s+(.+?)(?:[.!?]|$)/i,
    );
    if (remindMatch?.[1]) {
      const target = remindMatch[1].trim();
      if (!seen.has(target.toLowerCase()) && target.length > 2) {
        seen.add(target.toLowerCase());
        // Extract time detail if present
        const timeMatch = lower.match(/remind\s+me\s+(tonight|tomorrow|today)/);
        const details = timeMatch?.[1] ?? null;
        commands.push({ type: "ADD_REMINDER", target, details, confidence: "high" });
      }
    }
  }

  return commands;
}

// ── People extraction ─────────────────────────────────────────────────────────

// Common first names to help distinguish people from other proper nouns
const EXCLUDED_NAMES = new Set([
  "I", "The", "This", "That", "My", "Today", "Tomorrow", "Monday", "Tuesday",
  "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "January", "February",
  "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December", "God", "AI",
  // Common sentence starters that aren't names
  "It", "He", "She", "We", "They", "There", "Here", "What", "When", "Where",
  "Why", "How", "Its", "Our", "Their", "Then", "Now", "Still", "Just",
  "Plan", "Team", "Work", "Project", "Meeting", "Call", "Task",
]);

function extractPeopleUpdates(text: string, todayISO: string): PersonUpdateOutput[] {
  const updates = new Map<string, PersonUpdateOutput>();

  // Pattern: "I met [Name]" / "I talked to [Name]" / "spoke with [Name]" / "Lara was..."
  const meetPatterns = [
    /I met ([A-Z][a-z]+) today(?: at (.+?))?[.,]/gi,
    /I met ([A-Z][a-z]+)(?: at (.+?))?[.,]/gi,
    /I (?:talked|spoke|chatted) (?:to|with) ([A-Z][a-z]+)/gi,
    /([A-Z][a-z]+) (?:said|told me|mentioned|asked me|texted me|called me)/gi,
    // Behavioral observations: "Lara was very direct" / "Lara seemed nervous"
    /([A-Z][a-z]+) (?:was|is|has been|seemed|appeared|kept|stayed|came across as|behaved|acted)\b/gi,
  ];

  const mentionedNames = new Set<string>();

  for (const pattern of meetPatterns) {
    for (const match of text.matchAll(pattern)) {
      const name = match[1];
      if (!name || EXCLUDED_NAMES.has(name)) continue;
      mentionedNames.add(name);

      if (!updates.has(name)) {
        const isFirstMeet = /I met/.test(match[0]);
        const isBehavioral = /(?:was|is|seemed|appeared|kept|stayed|came across as|behaved|acted)\b/.test(match[0]);
        const summaryText = isBehavioral
          ? text.split(/[.!?]/)[0]?.trim() ?? `Observed interaction with ${name}`
          : `Interaction with ${name}.`;
        updates.set(name, {
          personName: name,
          personData: {
            nickname: null,
            relationshipType: null,
            firstMetDate: isFirstMeet ? todayISO : null,
            firstMetLocation: match[2]?.trim() ?? null,
            birthday: null,
            occupation: null,
            hometown: null,
            notes: null,
          },
          memories: [],
          interaction: {
            date: todayISO,
            location: match[2]?.trim() ?? null,
            summary: summaryText,
            topics: [],
            context: null,
            sentiment: null,
            followUpNeeded: false,
            followUpDate: null,
          },
          followUpTask: null,
          confidence: isBehavioral ? "medium" : "high",
          reason: isBehavioral ? `Behavioral observation about ${name}.` : `Detected interaction with ${name}.`,
          insights: [],
        });
      }
    }
  }

  // Extract specific facts per person
  for (const name of mentionedNames) {
    const update = updates.get(name)!;
    const sentences = splitSentences(text);

    for (const sentence of sentences) {
      const sl = sentence.toLowerCase();
      if (!sl.includes(name.toLowerCase())) continue;

      // Birthday: "[Name]'s birthday is June 5" / "birthday on March 3"
      const birthdayMatch = sentence.match(
        new RegExp(`${name}['']?s? birthday (?:is|on|:)\\s*([A-Za-z]+ \\d+(?:,? \\d{4})?)`, "i"),
      );
      if (birthdayMatch?.[1]) {
        update.personData.birthday = birthdayMatch[1].trim();
        update.memories.push({
          title: `${name}'s birthday`,
          content: `Birthday: ${birthdayMatch[1].trim()}`,
          type: "BIRTHDAY",
          importance: "PERMANENT",
        });
      }

      // Preference: "[Name] loves/likes/hates [X]"
      const prefMatch = sentence.match(
        new RegExp(`${name} (?:loves?|likes?|enjoys?|hates?|dislikes?|is passionate about)\\s+(.+?)(?:[.,!?]|$)`, "i"),
      );
      if (prefMatch?.[1]) {
        const pref = prefMatch[1].trim();
        update.memories.push({
          title: `${name} loves ${pref}`,
          content: sentence.trim(),
          type: "PREFERENCE",
          importance: "MEDIUM",
        });
      }

      // Feeling/situation: "[Name] is nervous/stressed/excited about [X]"
      const feelingMatch = sentence.match(
        new RegExp(`${name} (?:is|seems?|feels?)\\s+(nervous|stressed|excited|worried|happy|sad|anxious)(?:\\s+about\\s+(.+?))?(?:[.,!?]|$)`, "i"),
      );
      if (feelingMatch?.[1]) {
        const feeling = feelingMatch[1];
        const about = feelingMatch[2] ? ` about ${feelingMatch[2]}` : "";
        update.memories.push({
          title: `${name} is ${feeling}${about}`,
          content: sentence.trim(),
          type: "IMPORTANT_EVENT",
          importance: "HIGH",
        });
        if (update.interaction) {
          update.interaction.sentiment = feeling;
          if (feelingMatch[2]) update.interaction.topics.push(feelingMatch[2].trim());
        }
      }

      // Relationship: "[Name] is my [type]" / "my [type] [Name]"
      const relMatch = sentence.match(
        new RegExp(`(?:${name} is my|my) (friend|colleague|coworker|partner|dance partner|roommate|cousin|brother|sister|mentor|student)(?:\\s+${name})?`, "i"),
      );
      if (relMatch?.[1] && !update.personData.relationshipType) {
        update.personData.relationshipType = relMatch[1].toLowerCase();
      }

      // Occupation: "[Name] works as / is a [job]"
      const jobMatch = sentence.match(
        new RegExp(`${name} (?:works as|is a|is an)\\s+(.+?)(?:[.,!?]|$)`, "i"),
      );
      if (jobMatch?.[1] && !update.personData.occupation) {
        update.personData.occupation = jobMatch[1].trim();
      }
    }

    // Follow-up detection
    const followUpMatch = text.match(
      new RegExp(`remind me to (?:ask|check on|follow up with|check in with)?\\s*(?:${name})?\\s*(?:about\\s+(.+?))?(?:[.,!?]|$)`, "i"),
    );
    if (followUpMatch || /remind me to (?:ask|check)/.test(text)) {
      update.interaction = update.interaction ?? {
        date: todayISO, location: null, summary: `Interaction with ${name}.`,
        topics: [], context: null, sentiment: null, followUpNeeded: true, followUpDate: null,
      };
      if (update.interaction) update.interaction.followUpNeeded = true;
      const followUpDesc = followUpMatch?.[1]
        ? `Ask ${name} about ${followUpMatch[1].trim()}`
        : `Follow up with ${name}`;
      update.followUpTask = { title: followUpDesc, dueDate: null };
    }

    // Generate insights from interaction text
    update.insights = extractPersonInsights(text, name);
  }

  return Array.from(updates.values());
}

// ── Person insight extraction ─────────────────────────────────────────────────

interface InsightPattern {
  regex: RegExp;
  type: PersonInsightItemOutput["type"];
  buildInsight: (name: string, match: RegExpMatchArray, sentence: string) => PersonInsightItemOutput | null;
}

const INSIGHT_PATTERNS: InsightPattern[] = [
  {
    // Direct communication: "corrected the plan quickly", "very direct"
    regex: /\b(?:very |quite |so )?direct(?:ly)?\b/i,
    type: "COMMUNICATION_STYLE",
    buildInsight: (name, _match, sentence) => ({
      type: "COMMUNICATION_STYLE",
      title: `${name} may communicate directly`,
      content: `${name} seems to prefer direct, efficient communication. They may not need much preamble — getting to the point quickly likely works better.`,
      confidence: "MEDIUM",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Corrective / efficiency signals
    regex: /corrected|redirected|cut to|got straight to|jumped to the point/i,
    type: "COMMUNICATION_STYLE",
    buildInsight: (name, _match, sentence) => ({
      type: "COMMUNICATION_STYLE",
      title: `${name} may value efficiency in discussion`,
      content: `Based on this interaction, ${name} possibly prefers to keep conversations focused and may redirect when things feel off track.`,
      confidence: "LOW",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Warm in group
    regex: /warm(?:ly)?\s+(?:in|with|around|to(?:ward)?)\s+(?:the\s+)?group|great with (?:people|others|the group)/i,
    type: "SOCIAL_STYLE",
    buildInsight: (name, _match, sentence) => ({
      type: "SOCIAL_STYLE",
      title: `${name} seems socially warm in groups`,
      content: `${name} appears comfortable and warm in group settings. They may be energised by social interaction.`,
      confidence: "MEDIUM",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Privacy signal
    regex: /changed the topic|avoided|didn'?t want to talk about|deflected|got quiet/i,
    type: "TRUST_PATTERN",
    buildInsight: (name, _match, sentence) => ({
      type: "TRUST_PATTERN",
      title: `${name} may keep some topics private`,
      content: `${name} seems to prefer keeping certain subjects private until deeper trust is established. Respecting that boundary may help the relationship develop naturally.`,
      confidence: "LOW",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Energy / enthusiasm
    regex: /\b(?:excited|enthusiastic|lit up|energised|passionate)\b/i,
    type: "ENERGY_PATTERN",
    buildInsight: (name, _match, sentence) => ({
      type: "ENERGY_PATTERN",
      title: `${name} shows enthusiasm about certain topics`,
      content: `${name} appears to light up around topics they care about. Engaging them on those areas may deepen the connection.`,
      confidence: "MEDIUM",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Overthinking dynamic
    regex: /overthink|felt like i was overthinking|overexplain/i,
    type: "HOW_TO_APPROACH",
    buildInsight: (name) => ({
      type: "HOW_TO_APPROACH",
      title: `Avoid over-explaining with ${name}`,
      content: `Based on this interaction, ${name} may prefer concise communication. Over-explaining might slow things down — trust them to ask if they need more detail.`,
      confidence: "LOW",
      evidence: [],
    }),
  },
  {
    // Detail orientation
    regex: /\b(?:detail oriented|very thorough|very precise|asked lots of questions|wanted to know everything)\b/i,
    type: "COMMUNICATION_STYLE",
    buildInsight: (name, _match, sentence) => ({
      type: "COMMUNICATION_STYLE",
      title: `${name} may be detail-oriented`,
      content: `${name} seems to pay close attention to details. Providing thorough information upfront may work better with them.`,
      confidence: "MEDIUM",
      evidence: [sentence.trim()],
    }),
  },
  {
    // Listening well
    regex: /\b(?:listened well|really listened|good listener|let me finish|didn'?t interrupt)\b/i,
    type: "SOCIAL_STYLE",
    buildInsight: (name, _match, sentence) => ({
      type: "SOCIAL_STYLE",
      title: `${name} appears to be a good listener`,
      content: `${name} seems to make space for others to speak. This may indicate they value being heard themselves — giving them that space likely builds trust.`,
      confidence: "MEDIUM",
      evidence: [sentence.trim()],
    }),
  },
];

function extractPersonInsights(text: string, name: string): PersonInsightItemOutput[] {
  const insights: PersonInsightItemOutput[] = [];
  const usedTypes = new Set<string>();
  const sentences = splitSentences(text);

  for (const sentence of sentences) {
    if (!sentence.toLowerCase().includes(name.toLowerCase()) && insights.length === 0) {
      // Allow global patterns even without name mention if we already have a person
    }
    for (const pattern of INSIGHT_PATTERNS) {
      if (usedTypes.has(pattern.type)) continue;
      const match = sentence.match(pattern.regex);
      if (!match) continue;
      const insight = pattern.buildInsight(name, match, sentence);
      if (!insight) continue;
      insights.push(insight);
      usedTypes.add(pattern.type);
      if (insights.length >= 3) return insights;
    }
  }

  // Check for overthinking pattern without name in sentence
  if (insights.length < 3 && !usedTypes.has("HOW_TO_APPROACH")) {
    const overMatch = text.match(/\b(?:overthink|overexplain|felt like i was overthinking)\b/i);
    if (overMatch) {
      insights.push({
        type: "HOW_TO_APPROACH",
        title: `Consider being more concise with ${name}`,
        content: `Based on this interaction, being more direct with ${name} may help — over-explaining could slow things down.`,
        confidence: "LOW",
        evidence: [overMatch[0]],
      });
    }
  }

  return insights;
}

// ── Intent classification ─────────────────────────────────────────────────────

const INTENT_PATTERNS: Array<{ regex: RegExp; intent: Intent; reason: string }> = [
  { regex: /\b(?:what should i|what do i|help me (?:decide|prioritize)|i'?m overwhelmed|feeling stuck|don'?t know what to)\b/i, intent: "DECISION", reason: "Asking for guidance or feeling overwhelmed" },
  { regex: /\b(?:i'?m feeling|feeling (?:anxious|sad|down|low|frustrated|angry|nervous|worried|depressed|stressed))\b/i, intent: "REFLECTION", reason: "Emotional processing" },
  { regex: /\b(?:plan (?:my|the|for|this) (?:day|week|month)|what'?s my focus|weekly plan|daily plan)\b/i, intent: "PLAN", reason: "Requesting a plan" },
  { regex: /\b(?:what is|how (?:do i|does|can i)|can you (?:explain|tell me)|tell me about|what are the)\b/i, intent: "QUESTION", reason: "Asking for information" },
  { regex: /\b(?:i(?:'ve)? (?:finished|completed|done)|done with|mark .+? (?:as )?done)\b/i, intent: "UPDATE", reason: "Reporting task completion" },
  { regex: /\b(?:move|reschedule|postpone|delay|push) .+? to\b/i, intent: "UPDATE", reason: "Rescheduling" },
  { regex: /\b(?:i realized|i noticed (?:that )?i|i always|i tend to|the thing about me|i am someone who|i'?ve learned|my rule is|my principle)\b/i, intent: "MEMORY", reason: "Identity or pattern insight" },
  { regex: /\b(?:today i (?:did|finished|worked|accomplished)|here'?s what i did|what i did today|i accomplished)\b/i, intent: "JOURNAL", reason: "Journaling about today" },
];

function classifyIntentMock(text: string): IntentResultOutput {
  for (const { regex, intent, reason } of INTENT_PATTERNS) {
    if (regex.test(text)) {
      return { intent, confidence: "high", reason };
    }
  }
  // Default: if text looks action-oriented → CREATE
  const hasActionWord = /\b(?:need to|have to|must|should|want to|buy|call|email|finish|fix|send|schedule|write|book)\b/i.test(text);
  if (hasActionWord) return { intent: "CREATE", confidence: "high", reason: "Action-oriented text with task keywords" };

  // Detect person observations: "Lara was very direct" / "She seemed nervous"
  const personObsMatch = text.match(/\b([A-Z][a-z]{1,20})\s+(?:was|is|seemed|appeared|kept|came across)\b/);
  if (personObsMatch?.[1] && !EXCLUDED_NAMES.has(personObsMatch[1])) {
    return { intent: "CREATE", confidence: "medium", reason: `Person observation — extracting insights about ${personObsMatch[1]}` };
  }

  return { intent: "CREATE", confidence: "medium", reason: "General capture." };
}

// ── Recommendation ────────────────────────────────────────────────────────────

function generateRecommendationMock(text: string, contextPrompt: string): RecommendationOutput {
  const lower = text.toLowerCase();
  const isOverwhelmed = /overwhelm|stressed|anxious|too much|can'?t handle/.test(lower);
  const isSick = /sick|ill|tired|exhausted|unwell/.test(lower);

  // Try to extract top task from context
  const topTaskMatch = contextPrompt.match(/OPEN TASKS[^:]*:\s*[•\-]\s*([^\n\[]+)/);
  const topTask = topTaskMatch?.[1]?.trim() ?? null;

  const overdueMatch = contextPrompt.match(/OVERDUE \((\d+)\)/);
  const overdueCount = overdueMatch ? parseInt(overdueMatch[1] ?? "0") : 0;

  if (isSick) {
    return {
      summary: "You're not feeling well — switch to recovery mode. Do the bare minimum and rest.",
      reasoning: "Pushing through when sick leads to worse output and longer recovery.",
      topTask: null,
      thingsToIgnore: ["non-critical meetings", "low priority tasks", "new projects"],
      suggestedMode: "RECOVERY",
    };
  }

  if (isOverwhelmed && overdueCount >= 2) {
    return {
      summary: `You have ${overdueCount} overdue tasks. Stop adding more. Pick one task and finish it.`,
      reasoning: "Overwhelm is often caused by too many open loops, not too little time. Closing one thing creates momentum.",
      topTask,
      thingsToIgnore: ["new ideas", "low priority tasks", "inbox"],
      suggestedMode: "FOCUS",
    };
  }

  if (isOverwhelmed) {
    return {
      summary: topTask
        ? `Focus on one thing: "${topTask}". Everything else can wait.`
        : "Take a breath. Pick the single most important thing and do only that.",
      reasoning: "When overwhelmed, the best move is radical narrowing — not more planning.",
      topTask,
      thingsToIgnore: ["low priority tasks", "optional habits"],
      suggestedMode: "FOCUS",
    };
  }

  return {
    summary: topTask
      ? `Your top priority is "${topTask}". Start there.`
      : "Review your open tasks and pick the one with the most impact today.",
    reasoning: "Based on your current tasks and context, this is the highest-leverage move.",
    topTask,
    thingsToIgnore: [],
    suggestedMode: "NORMAL",
  };
}

// ── Reflection ────────────────────────────────────────────────────────────────

function generateReflectionMock(text: string): ReflectionResultOutput {
  const healthStatus = extractHealthStatus(text);
  const memoryCandidates = extractMemoryCandidates(text);

  const lower = text.toLowerCase();
  const feeling = healthStatus ? `Unwell — ${healthStatus.toLowerCase()}`
    : /anxious|anxiety/.test(lower) ? "Anxious"
    : /sad|down|low/.test(lower) ? "Low"
    : /happy|great|good/.test(lower) ? "Good"
    : /tired|exhausted/.test(lower) ? "Tired"
    : /stressed/.test(lower) ? "Stressed"
    : "";

  // Extract accomplishments
  const accomplishedMatch = text.match(/(?:i (?:did|finished|worked on|accomplished)|today i)\s+([^.!?]+)/i);
  const accomplished = accomplishedMatch?.[1]?.trim() ?? "";

  const reflection = healthStatus
    ? `Dealing with ${healthStatus.toLowerCase()} takes real energy — acknowledging that is important. Rest is not failure; it is part of the work. ${memoryCandidates.length > 0 ? "There is a meaningful insight worth keeping here." : "Tomorrow will look different."}`
    : `Processing what you are feeling is a productive act in itself. ${accomplished ? `You accomplished: ${accomplished}.` : ""} ${memoryCandidates.length > 0 ? "There is an insight here worth keeping." : "Check in with yourself before the day ends."}`

  return {
    reflection,
    journal: {
      feeling,
      accomplished,
      distractedBy: "",
      improveTomorrow: "",
    },
    memoryCandidates,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const mockProvider: AIProvider = {
  async organizeCapture(input: string): Promise<CaptureResult> {
    await new Promise((r) => setTimeout(r, 600));

    const todayISO = dateISO(0);
    const healthStatus = extractHealthStatus(input);
    const mood = extractMood(input, healthStatus);
    const tasks = extractTasks(input);
    const ideas = extractIdeas(input);
    const habits = extractHabits(input, healthStatus);
    const memoryCandidates = extractMemoryCandidates(input);
    const commands = extractCommands(input);
    const peopleUpdates = extractPeopleUpdates(input, todayISO);
    const events = extractEventPlaceholders(input);

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
      commands.length > 0 && `${commands.length} command${commands.length !== 1 ? "s" : ""} detected`,
      peopleUpdates.length > 0 && `${peopleUpdates.length} person update${peopleUpdates.length !== 1 ? "s" : ""} detected`,
      events.length > 0 && `${events.length} event placeholder${events.length !== 1 ? "s" : ""} detected`,
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
        events,
        memoryCandidates,
        commands,
        peopleUpdates,
      },
    };
  },

  async classifyIntent(text: string): Promise<IntentResultOutput> {
    await new Promise((r) => setTimeout(r, 100));
    return classifyIntentMock(text);
  },

  async generateRecommendation(text: string, contextPrompt: string): Promise<RecommendationOutput> {
    await new Promise((r) => setTimeout(r, 400));
    return generateRecommendationMock(text, contextPrompt);
  },

  async generateReflection(text: string): Promise<ReflectionResultOutput> {
    await new Promise((r) => setTimeout(r, 300));
    return generateReflectionMock(text);
  },

  async answerQuestion(text: string, contextPrompt: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 200));
    const lower = text.toLowerCase();
    if (/what should i work on|what'?s my priority/.test(lower)) {
      const topTaskMatch = contextPrompt.match(/OPEN TASKS[^:]*:\s*[•\-]\s*([^\n\[]+)/);
      const topTask = topTaskMatch?.[1]?.trim();
      return topTask ? `Your top priority right now is: ${topTask}.` : "Check your open tasks — the one due soonest or marked HIGH urgency is where to start.";
    }
    return "Based on your current context, I'd recommend reviewing your open tasks and focusing on the most urgent one first.";
  },
};
