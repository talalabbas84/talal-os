// Builds a ReadinessPlanData from event context and DB-enriched recommendations.
// Called once per event; result is stored in ReadinessPlan and re-served to the UI.

import { detectEventCategory, getTemplate, getFocusTip } from "./readiness-checklists";
import { buildRecommendations } from "./readiness-recommendations";
import { computeReadinessScore, scoreToLevel } from "./readiness-score";
import type {
  ReadinessInput,
  ReadinessPlanData,
  PreparedItem,
  MissingItem,
} from "./readiness-types";

export async function buildReadinessPlan(input: ReadinessInput): Promise<Omit<ReadinessPlanData, "id" | "generatedAt">> {
  const {
    userId,
    entityType,
    entityId,
    title,
    scheduledFor,
    location,
    description,
    linkedPersonId,
    linkedPersonName,
  } = input;

  const category = detectEventCategory(title, description);
  const template = getTemplate(category);

  // Confirmed prepared items based on what we know about this event
  const preparedItems: PreparedItem[] = buildPreparedItems({
    title,
    location,
    linkedPersonName,
    description,
    scheduledFor,
    category,
    template,
  });

  const preparedLabels = new Set(preparedItems.map((p) => p.label.toLowerCase()));

  // Missing items = template items not already confirmed as prepared
  const missingItems: MissingItem[] = template.checklistItems
    .filter((item) => !preparedLabels.has(item.toLowerCase()))
    .map((item) => ({
      label: item,
      priority: template.highPriority.includes(item) ? "high" : "medium",
    }))
    .slice(0, 5) as MissingItem[];

  const recommendations = await buildRecommendations({
    userId,
    category,
    linkedPersonId,
    linkedPersonName,
  });

  const score = computeReadinessScore(preparedItems, missingItems);
  const overallReadiness = scoreToLevel(score);

  const seed = scheduledFor.getDate() + scheduledFor.getMonth();
  const focusTip = getFocusTip(template, seed);

  return {
    entityType,
    entityId: entityId ?? null,
    title,
    scheduledFor,
    status: "NOT_STARTED",
    overallReadiness,
    preparedItems,
    missingItems,
    recommendations,
    focusTip,
  };
}

function buildPreparedItems(ctx: {
  title: string;
  location?: string;
  linkedPersonName?: string;
  description?: string;
  scheduledFor: Date;
  category: string;
  template: ReturnType<typeof getTemplate>;
}): PreparedItem[] {
  const items: PreparedItem[] = [];

  // Universal: the event is in the system = it exists
  items.push({ label: "Event captured in Talal OS" });

  // Location known
  if (ctx.location) {
    items.push({ label: `Location noted: ${ctx.location}` });
  }

  // Linked person known
  if (ctx.linkedPersonName) {
    items.push({ label: `Contact: ${ctx.linkedPersonName}` });
  }

  // Time is set (not all-day)
  const hours = ctx.scheduledFor.getHours();
  if (hours !== 12 || ctx.scheduledFor.getMinutes() !== 0) {
    // Non-noon means a real time was set (noon = all-day fallback)
    items.push({ label: "Time confirmed" });
  }

  // Description / notes present
  if (ctx.description && ctx.description.length > 10) {
    items.push({ label: "Notes added" });
  }

  return items;
}

// Parse "9:00 PM" / "14:30" / "9pm" into hours and minutes
export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  const normalized = timeStr.trim().toLowerCase();

  // "HH:MM AM/PM"
  const ampm = /^(\d{1,2}):(\d{2})\s*(am|pm)$/.exec(normalized);
  if (ampm) {
    let hours = parseInt(ampm[1]!, 10);
    const minutes = parseInt(ampm[2]!, 10);
    if (ampm[3] === "pm" && hours < 12) hours += 12;
    if (ampm[3] === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // "HH:MM" (24-hour)
  const hhmm = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (hhmm) {
    return { hours: parseInt(hhmm[1]!, 10), minutes: parseInt(hhmm[2]!, 10) };
  }

  // "9am" / "9pm"
  const shortAmpm = /^(\d{1,2})(am|pm)$/.exec(normalized);
  if (shortAmpm) {
    let hours = parseInt(shortAmpm[1]!, 10);
    if (shortAmpm[2] === "pm" && hours < 12) hours += 12;
    if (shortAmpm[2] === "am" && hours === 12) hours = 0;
    return { hours, minutes: 0 };
  }

  return null;
}

// Combine an EventPlaceholder's date (@db.Date = UTC midnight) with a time string
// to produce a full scheduledFor datetime.
export function buildScheduledFor(date: Date, timeString?: string | null): Date {
  const timeOfDay = timeString ? parseTimeString(timeString) : null;
  if (!timeOfDay) {
    // All-day event: use noon UTC as fallback so "scheduledFor !== midnight" stays true
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));
  }
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), timeOfDay.hours, timeOfDay.minutes, 0),
  );
}
