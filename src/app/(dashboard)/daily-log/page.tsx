import { getDailyLog } from "@/features/daily-log/actions/daily-log.actions";
import { DailyLogForm } from "@/features/daily-log/components/daily-log-form";

export default async function DailyLogPage() {
  const today = new Date().toISOString().split("T")[0];
  const log = await getDailyLog(today);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Daily Log
        </h1>
        <p className="text-sm text-neutral-500">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>
      <DailyLogForm date={today} log={log} />
    </div>
  );
}
