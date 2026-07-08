// Fast heuristic detector for health, current state, and health goal captures.
// Runs before the AI organize call to prevent physical/emotional observations
// from being incorrectly converted into tasks.

export type HealthCaptureType = "CURRENT_STATE" | "HEALTH_GOAL" | "RECOVERY";

export interface HealthDetection {
  type: HealthCaptureType;
  confidence: "high" | "medium";
  suggestedMood?: string;
  suggestedEnergyLevel?: "LOW" | "MEDIUM" | "HIGH";
  suggestedRecoveryMode?: boolean;
}

interface StatePattern {
  pattern: RegExp;
  mood: string;
  energy?: "LOW" | "MEDIUM" | "HIGH";
  recovery?: boolean;
}

const CURRENT_STATE_PATTERNS: StatePattern[] = [
  { pattern: /\b(sick|ill|unwell|nauseous|vomiting|fever|chills|headache|migraine|throat)\b/i, mood: "sick", energy: "LOW", recovery: true },
  { pattern: /\b(can'?t sleep|insomnia|no sleep|couldn'?t sleep|trouble sleeping|bad sleep|wide awake)\b/i, mood: "can't sleep", energy: "LOW" },
  { pattern: /\b(exhausted|burnt? ?out|burnout|drained|depleted|no energy)\b/i, mood: "exhausted", energy: "LOW", recovery: true },
  { pattern: /\b(so tired|very tired|super tired|really tired|dead tired|fatigued)\b/i, mood: "tired", energy: "LOW" },
  { pattern: /\b(in pain|really hurting|my (back|shoulder|knee|leg|head|neck) (hurts|is killing|is aching))\b/i, mood: "in pain", energy: "LOW", recovery: true },
  { pattern: /\bfeeling (sick|awful|terrible|horrible|miserable|really bad|really low|very low|off)\b/i, mood: "unwell", energy: "LOW" },
  { pattern: /\bcan'?t focus|brain fog|can'?t concentrate\b/i, mood: "brain fog", energy: "LOW" },
];

const HEALTH_GOAL_PATTERNS: RegExp[] = [
  /\b(want to|trying to|planning to|going to|need to|i should|i have to)\b.{0,40}\b(sleep (earlier|better|more|well)|eat (better|healthier|cleaner)|lose weight|gain weight|get fit|exercise more|drink more water|fix my sleep)\b/i,
  /\bimprove (my )?(sleep( quality| schedule| routine)?|health|energy|diet|nutrition|fitness|routine)\b/i,
  /\bsleep (goal|schedule|routine|habit|hygiene)\b/i,
];

const RECOVERY_PATTERNS: RegExp[] = [
  /\b(rest day|taking it easy|recovery day|low[ -]energy day|off day)\b/i,
  /\bfeeling (low|off|not (great|good|well)|rough|out of it|depleted)\b/i,
];

export function detectHealthCapture(text: string): HealthDetection | null {
  // Skip if the text is clearly action-oriented (tasks/commands)
  // e.g., "Set reminder to wake up at 9" is a task, not a health state
  const actionPrefixes = /^\s*(set|create|add|remind|schedule|book|plan|buy|call|email|message)\b/i;
  if (actionPrefixes.test(text) && text.length < 60) return null;

  // High-confidence: explicit physical/health state
  for (const { pattern, mood, energy, recovery } of CURRENT_STATE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "CURRENT_STATE",
        confidence: "high",
        suggestedMood: mood,
        suggestedEnergyLevel: energy ?? "LOW",
        suggestedRecoveryMode: recovery,
      };
    }
  }

  // Medium-confidence: health goal (aspirational health)
  for (const pattern of HEALTH_GOAL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "HEALTH_GOAL",
        confidence: "medium",
      };
    }
  }

  // Medium-confidence: recovery / low energy day
  for (const pattern of RECOVERY_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: "RECOVERY",
        confidence: "medium",
        suggestedEnergyLevel: "LOW",
      };
    }
  }

  return null;
}

// Returns true for task titles that are clearly health management observations
// rather than genuine actionable tasks.
// Used to sanitize AI output from slipping through.
export function isHealthObservationTask(title: string): boolean {
  const lower = title.toLowerCase();
  return /^(get enough sleep|sleep (better|more|earlier)|wake up at \d|try to sleep|fix (my )?sleep|rest more|drink more water|eat (better|healthier)|feel better|recover|take it easy|don'?t stress|take care)/.test(lower);
}
