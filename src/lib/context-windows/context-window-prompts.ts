import type { PersonContext } from "./context-window-types";

// Bridge template: matched by previous + next category
interface BridgeTemplate {
  prev: string[];   // previous window categories
  next: string[];   // next window categories (empty = any)
  text: string;
}

const TEMPLATES: BridgeTemplate[] = [
  // Physical → Social
  { prev: ["dance", "workout"], next: ["social_event"], text: "Drink water and cool down before you go." },
  // Physical → Work
  { prev: ["dance", "workout"], next: ["work_task", "work", "other"], text: "Eat something light, hydrate, then get started." },
  // Physical → More physical
  { prev: ["dance", "workout"], next: ["dance_class", "workout"], text: "Stretch, hydrate, and review what you want to focus on." },
  // Work → Social
  { prev: ["work"], next: ["social_event"], text: "Save your progress and shift gears — presence is the goal." },
  // Work → Reflection / Sleep
  { prev: ["work"], next: ["reflection", "sleep"], text: "Stop adding. Capture what you finished and write one lesson learned." },
  // Work → Break / Rest
  { prev: ["work"], next: ["rest", "break", "other"], text: "Step away for real — you need the reset to come back strong." },
  // Social → Work
  { prev: ["social"], next: ["work_task", "work"], text: "Reset your workspace, then start with the smallest thing." },
  // Social → Reflection
  { prev: ["social"], next: ["reflection", "sleep"], text: "Sit with what happened before jumping to the next thing." },
  // Learning → Work
  { prev: ["learning"], next: ["work_task", "work", "other"], text: "Write one sentence from what you just learned before moving on." },
  // Learning → Social
  { prev: ["learning"], next: ["social_event"], text: "Capture the key idea, then show up fully." },
  // Food → Work
  { prev: ["food"], next: ["work_task", "work"], text: "Wait 10 minutes before starting — your focus will be sharper." },
  // Rest / Recovery → Work
  { prev: ["rest", "recovery"], next: ["work_task", "work"], text: "Start with the smallest task. Five minutes builds the momentum." },
  // Anything → Social (fallback)
  { prev: [], next: ["social_event"], text: "Be fully present — that's what matters most right now." },
  // Anything → Sleep
  { prev: [], next: ["sleep"], text: "Write one note from today, then put the devices away." },
  // Anything → Reflection
  { prev: [], next: ["reflection"], text: "Take 5 minutes to sit with the day before jumping anywhere." },
];

function personNote(ctx: PersonContext): string {
  if (ctx.lastTopic) {
    return `Last time you saw ${ctx.name}, you talked about ${ctx.lastTopic}. Ask how that's going.`;
  }
  if (ctx.lastSummary) {
    const sentence = ctx.lastSummary.split(".")[0]?.trim() ?? ctx.lastSummary;
    return `Last time with ${ctx.name}: ${sentence.toLowerCase()}. Follow up on that.`;
  }
  return `Be present with ${ctx.name}.`;
}

export function buildBridgeText(
  prevCategory: string | null,
  nextCategory: string | null,
  minutesUntilNext: number | null,
  personContext: PersonContext | null,
): string | null {
  // High urgency: less than 30 minutes away
  if (minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext < 30) {
    const timeStr = minutesUntilNext < 5 ? "now" : `in ${Math.round(minutesUntilNext)} minutes`;
    const urgency = `Leave ${timeStr}.`;
    const pNote = personContext ? ` ${personNote(personContext)}` : "";
    return `${urgency}${pNote}`;
  }

  // Find best matching template: check prev+next, then prev-only, then next-only
  const match =
    TEMPLATES.find(
      (t) =>
        t.prev.length > 0 &&
        t.next.length > 0 &&
        t.prev.includes(prevCategory ?? "") &&
        t.next.includes(nextCategory ?? ""),
    ) ??
    TEMPLATES.find(
      (t) => t.prev.length > 0 && t.next.length === 0 && t.prev.includes(prevCategory ?? ""),
    ) ??
    TEMPLATES.find(
      (t) => t.prev.length === 0 && t.next.length > 0 && t.next.includes(nextCategory ?? ""),
    );

  const baseText = match?.text ?? null;
  const pNote = personContext ? personNote(personContext) : null;

  if (baseText && pNote) return `${baseText} ${pNote}`;
  if (baseText) return baseText;
  if (pNote) return pNote;
  return null;
}
