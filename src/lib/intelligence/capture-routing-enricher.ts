import type { CaptureResult, EventPlaceholderOutput, PersonUpdateOutput, ReminderOutput } from "@/lib/ai/types";

const PERSON_STOP_WORDS = new Set([
  "Dance",
  "Dinner",
  "Gym",
  "Grocery",
  "Groceries",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Today",
  "Tomorrow",
]);

const PERSON_DATA_DEFAULT = {
  nickname: null,
  relationshipType: null,
  firstMetDate: null,
  firstMetLocation: null,
  birthday: null,
  occupation: null,
  hometown: null,
  notes: null,
} as const;

export function enrichCaptureRouting(capture: CaptureResult, rawText: string, articulatedText: string): CaptureResult {
  const source = normalizeSource(`${rawText}\n${articulatedText}`);
  const inferredEvents = inferEventPlaceholders(source);
  const events = mergeEvents(capture.data.events, inferredEvents);
  const peopleUpdates = mergePeopleUpdates(capture.data.peopleUpdates, inferPeopleUpdates(source, events));
  const reminders = mergeReminders(capture.data.reminders, inferReminders(events));

  if (
    events === capture.data.events &&
    peopleUpdates === capture.data.peopleUpdates &&
    reminders === capture.data.reminders
  ) {
    return capture;
  }

  return {
    ...capture,
    data: {
      ...capture.data,
      events,
      peopleUpdates,
      reminders,
      summary: enrichSummary(capture.data.summary, events, peopleUpdates, reminders),
    },
  };
}

function inferEventPlaceholders(source: string): EventPlaceholderOutput[] {
  if (!/\b(dinner|lunch|coffee|meet(?:ing)?|plan|class|appointment|call|date)\b/i.test(source)) {
    return [];
  }

  const personName = extractPersonName(source);
  const date = resolveDate(source);
  if (!date) return [];

  const time = extractTime(source);
  const kind = extractEventKind(source);
  const title = personName && kind ? `${kind} with ${personName}` : kind ?? "Planned event";
  const afterContext = source.match(/\bafter\s+(?:my\s+)?([^,.!?]+?)(?:\s+at\s+|\s+around\s+|[,.!?]|$)/i)?.[1]?.trim();
  const timeContext = afterContext ? `after ${afterContext}` : null;

  return [{
    title,
    description: buildEventDescription(kind, personName, afterContext, time),
    date,
    time,
    timeContext,
    location: null,
    relatedPersonName: personName,
    needsReminder: true,
    confidence: "high",
  }];
}

function inferPeopleUpdates(source: string, events: EventPlaceholderOutput[]): PersonUpdateOutput[] {
  return events
    .filter((event) => event.relatedPersonName)
    .map((event) => {
      const personName = event.relatedPersonName!;
      const followUpSubject = event.title
        .replace(new RegExp(`\\s+with\\s+${escapeRegExp(personName)}$`, "i"), "")
        .toLowerCase();
      return {
        personName,
        personData: PERSON_DATA_DEFAULT,
        memories: [],
        interaction: {
          date: event.date,
          location: event.location,
          summary: buildInteractionSummary(event),
          topics: [event.title],
          context: event.timeContext ?? "planned_interaction",
          sentiment: null,
          followUpNeeded: true,
          followUpDate: event.date,
        },
        followUpTask: {
          title: `Ask ${personName} how ${followUpSubject} went`,
          dueDate: event.date,
        },
        insights: [],
        confidence: "high",
        reason: "Person mentioned in a future plan.",
      };
    });
}

function inferReminders(events: EventPlaceholderOutput[]): ReminderOutput[] {
  return events
    .filter((event) => event.needsReminder)
    .map((event) => ({
      title: `Remind me: ${event.title}`,
      when: [event.date, event.time].filter(Boolean).join(" ") || null,
      confidence: "high",
    }));
}

function mergeEvents(existing: EventPlaceholderOutput[], inferred: EventPlaceholderOutput[]): EventPlaceholderOutput[] {
  const next = [...existing];
  let changed = false;

  for (const event of inferred) {
    const matchIndex = next.findIndex((current) => shouldMergeEvent(current, event));
    if (matchIndex === -1) {
      next.push(event);
      changed = true;
      continue;
    }

    const current = next[matchIndex]!;
    const merged = mergeEvent(current, event);
    if (JSON.stringify(current) !== JSON.stringify(merged)) {
      next[matchIndex] = merged;
      changed = true;
    }
  }

  return changed ? next : existing;
}

function mergePeopleUpdates(existing: PersonUpdateOutput[], inferred: PersonUpdateOutput[]): PersonUpdateOutput[] {
  const next = [...existing];
  let changed = false;

  for (const person of inferred) {
    const index = next.findIndex((current) => sameText(current.personName, person.personName));
    if (index === -1) {
      next.push(person);
      changed = true;
      continue;
    }

    const current = next[index]!;
    next[index] = {
      ...current,
      interaction: current.interaction ?? person.interaction,
      followUpTask: current.followUpTask ?? person.followUpTask,
      confidence: current.confidence === "low" ? person.confidence : current.confidence,
    };
    changed = true;
  }

  return changed ? next : existing;
}

function mergeReminders(existing: ReminderOutput[], inferred: ReminderOutput[]): ReminderOutput[] {
  const next = [...existing];
  let changed = false;

  for (const reminder of inferred) {
    const normalizedTitle = reminder.title.replace(/^Remind me:\s*/i, "");
    const index = next.findIndex((current) =>
      sameText(current.title, reminder.title) ||
      sameText(current.title, normalizedTitle) ||
      sameText(current.title.replace(/^Remind me:\s*/i, ""), normalizedTitle) ||
      (isGenericTitle(current.title.replace(/^Remind me:\s*/i, "")) && sameEventKind(current.title, normalizedTitle)),
    );

    if (index === -1) {
      next.push(reminder);
      changed = true;
      continue;
    }

    const current = next[index]!;
    const merged = {
      ...current,
      title: isGenericTitle(current.title) ? reminder.title : current.title,
      when: current.when ?? reminder.when,
      confidence: current.confidence === "low" ? reminder.confidence : current.confidence,
    };
    if (JSON.stringify(current) !== JSON.stringify(merged)) {
      next[index] = merged;
      changed = true;
    }
  }

  return changed ? next : existing;
}

function enrichSummary(
  summary: string,
  events: EventPlaceholderOutput[],
  peopleUpdates: PersonUpdateOutput[],
  reminders: ReminderOutput[],
): string {
  const parts = [
    summary,
    events.length > 0 && `${events.length} event placeholder${events.length !== 1 ? "s" : ""} detected`,
    peopleUpdates.length > 0 && `${peopleUpdates.length} person update${peopleUpdates.length !== 1 ? "s" : ""} detected`,
    reminders.length > 0 && `${reminders.length} reminder intent${reminders.length !== 1 ? "s" : ""} detected`,
  ].filter(Boolean);

  return Array.from(new Set(parts)).join(". ");
}

function extractEventKind(source: string): string | null {
  if (/\bdinner\b/i.test(source)) return "Dinner";
  if (/\blunch\b/i.test(source)) return "Lunch";
  if (/\bcoffee\b/i.test(source)) return "Coffee";
  if (/\bdance class\b/i.test(source)) return "Dance class";
  if (/\bclass\b/i.test(source)) return "Class";
  if (/\bmeeting\b/i.test(source)) return "Meeting";
  if (/\bcall\b/i.test(source)) return "Call";
  if (/\bappointment\b/i.test(source)) return "Appointment";
  if (/\bdate\b/i.test(source)) return "Date";
  if (/\bplan\b/i.test(source)) return "Plan";
  return null;
}

function buildEventDescription(
  kind: string | null,
  personName: string | null,
  afterContext: string | undefined,
  time: string | null,
): string {
  const subject = [kind ?? "Plan", personName && `with ${personName}`].filter(Boolean).join(" ");
  const context = afterContext ? ` after ${afterContext}` : "";
  const timePhrase = time ? `, around ${formatDisplayTime(time)}` : "";
  return `${subject}${context}${timePhrase}.`;
}

function buildInteractionSummary(event: EventPlaceholderOutput): string {
  const context = event.timeContext ? ` ${event.timeContext}` : "";
  const time = event.time ? ` around ${formatDisplayTime(event.time)}` : "";
  return `${event.title} planned for ${event.date}${context}${time}.`;
}

function shouldMergeEvent(current: EventPlaceholderOutput, inferred: EventPlaceholderOutput): boolean {
  if (current.date && inferred.date && current.date !== inferred.date) return false;
  if (sameText(current.title, inferred.title)) return true;
  if (isGenericTitle(current.title) && sameEventKind(current.title, inferred.title)) return true;
  if (current.relatedPersonName && inferred.relatedPersonName && sameText(current.relatedPersonName, inferred.relatedPersonName)) {
    return sameEventKind(current.title, inferred.title);
  }
  return false;
}

function mergeEvent(current: EventPlaceholderOutput, inferred: EventPlaceholderOutput): EventPlaceholderOutput {
  const title = shouldUpgradeTitle(current, inferred) ? inferred.title : current.title;
  return {
    ...current,
    title,
    description: chooseRicherText(current.description, inferred.description),
    date: current.date ?? inferred.date,
    time: current.time ?? inferred.time,
    timeContext: current.timeContext ?? inferred.timeContext,
    location: current.location ?? inferred.location,
    relatedPersonName: current.relatedPersonName ?? inferred.relatedPersonName,
    needsReminder: current.needsReminder || inferred.needsReminder,
    confidence: current.confidence === "low" ? inferred.confidence : current.confidence,
  };
}

function shouldUpgradeTitle(current: EventPlaceholderOutput, inferred: EventPlaceholderOutput): boolean {
  if (!current.relatedPersonName && inferred.relatedPersonName) return true;
  if (isGenericTitle(current.title) && !isGenericTitle(inferred.title)) return true;
  return inferred.title.length > current.title.length && sameEventKind(current.title, inferred.title);
}

function chooseRicherText(current: string | null | undefined, inferred: string | null | undefined): string {
  const a = current ?? "";
  const b = inferred ?? "";
  return b.length > a.length ? b : a;
}

function sameEventKind(a: string, b: string): boolean {
  const kindA = extractEventKind(a)?.toLowerCase();
  const kindB = extractEventKind(b)?.toLowerCase();
  return !!kindA && kindA === kindB;
}

function isGenericTitle(title: string): boolean {
  return /^(dinner|lunch|coffee|meeting|call|appointment|date|plan|class|dance class)$/i.test(title.trim());
}

function extractPersonName(source: string): string | null {
  const patterns = [
    /\bwith\s+([A-Z][a-z]{1,30})\b/,
    /\bmeet(?:ing)?\s+([A-Z][a-z]{1,30})\b/,
    /\bcall\s+([A-Z][a-z]{1,30})\b/,
  ];

  for (const pattern of patterns) {
    const name = source.match(pattern)?.[1];
    if (name && !PERSON_STOP_WORDS.has(name)) return name;
  }

  return null;
}

function resolveDate(source: string): string | null {
  const lower = source.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (/\btoday\b/.test(lower)) return toISODate(today);
  if (/\btomorrow\b/.test(lower)) return toISODate(addDays(today, 1));

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (let i = 0; i < weekdays.length; i++) {
    const weekday = weekdays[i]!;
    if (new RegExp(`\\b(?:this\\s+|next\\s+)?${weekday}\\b`, "i").test(source)) {
      const diff = ((i - today.getDay() + 7) % 7) || 7;
      return toISODate(addDays(today, diff));
    }
  }

  const iso = source.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;

  return null;
}

function extractTime(source: string): string | null {
  const match = source.match(/\b(?:at|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match?.[1]) return null;

  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const suffix = match[3]?.toLowerCase();

  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (!suffix && hour >= 1 && hour <= 7 && /\b(dinner|evening|night|after.+dance)\b/i.test(source)) hour += 12;

  return `${hour.toString().padStart(2, "0")}:${minute}`;
}

function formatDisplayTime(time: string): string {
  const [rawHour, minute = "00"] = time.split(":");
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

function normalizeSource(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}
