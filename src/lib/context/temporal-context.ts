export interface TemporalContext {
  now: Date;
  isoDate: string;       // "2026-07-07"
  localTime: string;     // "14:32"
  dayOfWeek: string;     // "Monday"
  timezone: string;      // "America/Toronto"
  todayMidnight: Date;   // UTC Date representing midnight on the local day (for Prisma comparisons)
  prompt: string;        // ready-to-inject prompt line for AI context
}

export function getTemporalContext(timezone = "America/Toronto"): TemporalContext {
  const now = new Date();

  const isoDate = now.toLocaleDateString("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const localTime = now.toLocaleTimeString("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dayOfWeek = now.toLocaleDateString("en-CA", {
    timeZone: timezone,
    weekday: "long",
  });

  // Construct UTC midnight for the local date so Prisma date comparisons work
  // regardless of server timezone.
  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];
  const todayMidnight = new Date(Date.UTC(year, month - 1, day));

  const prompt = `NOW: ${isoDate} (${dayOfWeek}), ${localTime} ${timezone}`;

  return { now, isoDate, localTime, dayOfWeek, timezone, todayMidnight, prompt };
}
