import type { EventPlaceholder } from "@prisma/client";

function formatEventTime(time: string | null): string {
  if (!time) return "All day";
  return time;
}

export function TodaysSchedule({
  events,
  isoDate,
}: {
  events: EventPlaceholder[];
  isoDate: string;
}) {
  const todayEvents = events.filter(
    (ev) => ev.date.toISOString().split("T")[0] === isoDate,
  );
  if (!todayEvents.length) return null;

  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
        Today
      </p>
      <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {todayEvents.map((ev) => (
          <div key={ev.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
              {formatEventTime(ev.time)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                {ev.title}
              </p>
              {ev.location && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500">{ev.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
