import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDailyPlan } from "@/lib/planning/daily-plan";
import { getTemporalContext } from "@/lib/context/temporal-context";
import { HomeCapture } from "@/features/dashboard/components/home-capture";
import { getFollowUpQueueItems } from "@/features/follow-up/actions/queue.actions";
import { FollowUpCard } from "@/features/follow-up/components/follow-up-card";
import { getReadinessForDashboard } from "@/lib/readiness/readiness-engine";
import { ReadinessCard } from "@/features/readiness/components/readiness-card";
import type { DailyPlan } from "@/lib/planning/daily-plan";
import type { UserState, EventPlaceholder, LifeTimelineEntry } from "@prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "Talal";
  const temporal = getTemporalContext("America/Toronto");
  const today = temporal.todayMidnight;

  const [plan, userState, nextEvents, todayStory, oneQuestion, followUps, readinessPlans] = await Promise.all([
    buildDailyPlan(userId),
    prisma.userState.findUnique({ where: { userId } }),
    prisma.eventPlaceholder.findMany({
      where: { userId, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 3,
    }),
    prisma.lifeTimelineEntry.findMany({
      where: { userId, occurredAt: { gte: today } },
      orderBy: { occurredAt: "asc" },
      take: 12,
    }),
    prisma.reflectionQuestion.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    getFollowUpQueueItems(3).catch(() => [] as Awaited<ReturnType<typeof getFollowUpQueueItems>>),
    getReadinessForDashboard(userId, 3).catch(() => []),
  ]);

  const hour = parseInt(temporal.localTime.split(":")[0] ?? "12", 10);
  const greeting = buildGreeting(firstName, hour, plan, nextEvents);
  const contextChips = buildContextChips(plan, userState, nextEvents, temporal.isoDate);
  const rightNow = buildRightNow(plan);
  const dontForget = buildDontForget(plan, nextEvents, temporal.isoDate);
  const question = oneQuestion ?? (plan.todaysQuestions[0] ? {
    id: plan.todaysQuestions[0].id,
    question: plan.todaysQuestions[0].question,
    reason: plan.todaysQuestions[0].reason ?? null,
    status: "OPEN" as const,
  } : null);
  const storyItems = buildStoryItems(todayStory, plan);

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-4 pb-24 pt-8 sm:pt-12">
      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <section className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {greeting.headline}
        </h1>
        {greeting.subline && (
          <p className="text-lg text-neutral-600 dark:text-neutral-400">{greeting.subline}</p>
        )}
        {greeting.note && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">{greeting.note}</p>
        )}
      </section>

      {/* ── Current Context ──────────────────────────────────────────────── */}
      {contextChips.length > 0 && (
        <section>
          <div className="flex flex-wrap gap-2">
            {contextChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              >
                <span className="text-neutral-400 dark:text-neutral-500">{chip.label}</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{chip.value}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Talk to Talal OS ─────────────────────────────────────────────── */}
      <section>
        <HomeCapture />
      </section>

      {/* ── Getting Ready ────────────────────────────────────────────────── */}
      {readinessPlans.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Getting Ready
          </p>
          <div className="space-y-3">
            {readinessPlans.map((rp) => (
              <ReadinessCard key={rp.id} plan={rp} now={temporal.now} />
            ))}
          </div>
        </section>
      )}

      {/* ── Right Now ────────────────────────────────────────────────────── */}
      {rightNow && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Right Now
          </p>
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
            {rightNow.project && (
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">{rightNow.project}</p>
            )}
            <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {rightNow.verb} {rightNow.title}
            </p>
            {rightNow.reason && (
              <p className="mt-1.5 text-sm leading-6 text-neutral-500">{rightNow.reason}</p>
            )}
            <Link
              href={rightNow.href}
              className="mt-4 inline-flex items-center gap-1 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Start →
            </Link>
          </div>
        </section>
      )}

      {/* ── Don't Forget ─────────────────────────────────────────────────── */}
      {dontForget.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Don&apos;t Forget
          </p>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {dontForget.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                <span className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">{item.text}</span>
                {item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's Follow-ups ───────────────────────────────────────────── */}
      {followUps.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Follow-ups
          </p>
          <div className="space-y-2">
            {followUps.map((item) => (
              <FollowUpCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── One Question ─────────────────────────────────────────────────── */}
      {question && (
        <section>
          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              One Question
            </p>
            <p className="mt-3 text-base font-medium leading-7 text-neutral-900 dark:text-neutral-50">
              {question.question}
            </p>
            {question.reason && (
              <p className="mt-1 text-sm leading-6 text-neutral-500">{question.reason}</p>
            )}
            <Link
              href={`/capture?question=${question.id}`}
              className="mt-4 inline-block rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Answer in Capture
            </Link>
          </div>
        </section>
      )}

      {/* ── Today's Story ────────────────────────────────────────────────── */}
      {storyItems.length > 0 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
            Today&apos;s Story
          </p>
          <div className="space-y-0.5">
            {storyItems.map((item, i) => (
              <div key={i} className="flex items-start gap-4 py-2">
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                  {formatTime(item.time)}
                </span>
                <span className="mt-0.5 h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{item.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Data builders ─────────────────────────────────────────────────────────────

function buildGreeting(
  firstName: string,
  hour: number,
  plan: DailyPlan,
  nextEvents: EventPlaceholder[],
): { headline: string; subline: string; note?: string } {
  const timeGreeting =
    hour < 5 ? "Still up," :
    hour < 12 ? "Good morning," :
    hour < 17 ? "Good afternoon," :
    hour < 21 ? "Good evening," : "Good night,";

  if (plan.recoveryMode) {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Take it easy today.",
      note: "One small thing done is enough.",
    };
  }

  const todayEvent = nextEvents[0];
  if (todayEvent) {
    const label = todayEvent.time
      ? `${todayEvent.title} at ${todayEvent.time}`
      : todayEvent.title;
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `You have ${label.toLowerCase()} today.`,
      note: "Everything else can wait.",
    };
  }

  if (plan.topTasks[0]) {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `Let's continue: ${plan.topTasks[0].title}.`,
    };
  }

  if (plan.habitsDue.length > 0) {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `${plan.habitsDue.length} habit${plan.habitsDue.length > 1 ? "s" : ""} to keep up today.`,
    };
  }

  return {
    headline: `${timeGreeting} ${firstName}.`,
    subline: "What's on your mind?",
  };
}

function buildContextChips(
  plan: DailyPlan,
  userState: UserState | null,
  nextEvents: EventPlaceholder[],
  isoDate: string,
): Array<{ label: string; value: string }> {
  const chips: Array<{ label: string; value: string }> = [];

  const mission = userState?.currentMission ?? plan.todayMission;
  if (mission) chips.push({ label: "Chapter", value: truncate(mission, 32) });

  if (userState?.energyLevel) {
    const energyMap = { LOW: "Low energy", MEDIUM: "Normal", HIGH: "High energy" };
    chips.push({ label: "Energy", value: energyMap[userState.energyLevel] });
  }

  if (plan.recoveryMode) {
    chips.push({ label: "Mode", value: "Recovery" });
  }

  const nextEvent = nextEvents[0];
  if (nextEvent) {
    const dateLabel = nextEvent.date.toISOString().split("T")[0] === isoDate
      ? "today"
      : "tomorrow";
    const label = nextEvent.time ? `${nextEvent.title} ${nextEvent.time} ${dateLabel}` : `${nextEvent.title} ${dateLabel}`;
    chips.push({ label: "Next", value: truncate(label, 30) });
  }

  return chips.slice(0, 4);
}

function buildRightNow(plan: DailyPlan) {
  if (plan.topTasks[0]) {
    return {
      verb: "Continue:",
      title: plan.topTasks[0].title,
      reason: plan.suggestion || null,
      href: "/tasks",
      project: plan.topTasks[0].project?.name ?? null,
    };
  }
  if (plan.habitsDue[0]) {
    return {
      verb: "Do:",
      title: plan.habitsDue[0].name,
      reason: "Part of your daily routine.",
      href: "/habits",
      project: null,
    };
  }
  if (plan.dueLearningItems[0]) {
    return {
      verb: "Review:",
      title: plan.dueLearningItems[0].title,
      reason: "Your learning is due for review.",
      href: "/learn/review",
      project: null,
    };
  }
  return null;
}

function buildDontForget(
  plan: DailyPlan,
  nextEvents: EventPlaceholder[],
  isoDate: string,
): Array<{ text: string; href?: string }> {
  const items: Array<{ text: string; href?: string }> = [];

  for (const ev of nextEvents.slice(0, 2)) {
    const dateLabel = ev.date.toISOString().split("T")[0] === isoDate ? "today" : "tomorrow";
    const label = ev.time ? `${ev.title} at ${ev.time} (${dateLabel})` : `${ev.title} (${dateLabel})`;
    items.push({ text: label });
  }

  for (const person of plan.peopleToFollowUp.slice(0, 2)) {
    items.push({ text: `Follow up: ${person}`, href: "/people" });
  }

  for (const habit of plan.habitsDue.slice(0, 1)) {
    if (items.length < 5) items.push({ text: habit.name, href: "/habits" });
  }

  for (const item of plan.dueLearningItems.slice(0, 1)) {
    if (items.length < 5) items.push({ text: `Review: ${item.title}`, href: "/learn/review" });
  }

  return items.slice(0, 5);
}

function buildStoryItems(
  todayStory: LifeTimelineEntry[],
  plan: DailyPlan,
): Array<{ time: Date; title: string }> {
  if (todayStory.length > 0) {
    return todayStory.map((e) => ({ time: e.occurredAt, title: e.title }));
  }
  return plan.todayActivityLogs.map((a) => ({ time: a.createdAt, title: a.activity }));
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
