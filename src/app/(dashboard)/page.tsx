import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDailyPlan } from "@/lib/planning/daily-plan";
import { getTemporalContext } from "@/lib/context/temporal-context";
import { getActiveLifeState, getStateLayout, LIFE_STATE_LABELS } from "@/lib/life-state/life-state-engine";
import { runContextWindowEngine } from "@/lib/context-windows/context-window-engine";
import { NowFlow } from "@/features/dashboard/components/now-flow";
import type { ContextWindowData } from "@/lib/context-windows/context-window-engine";
import { HomeCapture } from "@/features/dashboard/components/home-capture";
import { RightNowCard } from "@/features/dashboard/components/right-now-card";
import { TodaysSchedule } from "@/features/dashboard/components/todays-schedule";
import { ReflectionCard } from "@/features/dashboard/components/reflection-card";
import { RecoveryGuide } from "@/features/dashboard/components/recovery-guide";
import { BreakGuide } from "@/features/dashboard/components/break-guide";
import { LearningReview } from "@/features/dashboard/components/learning-review";
import { SocialGuide } from "@/features/dashboard/components/social-guide";
import { CeoReview } from "@/features/dashboard/components/ceo-review";
import { getReadinessForDashboard } from "@/lib/readiness/readiness-engine";
import { ReadinessCard } from "@/features/readiness/components/readiness-card";
import type { DailyPlan, ActivityLogSummary } from "@/lib/intelligence/morning-planning-engine";
import type { UserState, EventPlaceholder, LifeTimelineEntry } from "@prisma/client";
import type { RightNowItem } from "@/features/dashboard/components/right-now-card";
import type { ReadinessPlanData } from "@/lib/readiness/readiness-types";
import type { SectionId } from "@/lib/home/home-types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const firstName = session.user.name?.split(" ")[0] ?? "Talal";
  const temporal = getTemporalContext("America/Toronto");
  const now = temporal.now;
  const today = temporal.todayMidnight;

  const [plan, userState, nextEvents, lifeTimeline, oneQuestion, readinessPlans, contextWindow] =
    await Promise.all([
      buildDailyPlan(userId),
      prisma.userState.findUnique({ where: { userId } }),
      prisma.eventPlaceholder.findMany({
        where: { userId, date: { gte: today } },
        orderBy: { date: "asc" },
        take: 5,
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
      getReadinessForDashboard(userId, 3).catch(() => [] as ReadinessPlanData[]),
      runContextWindowEngine(userId).catch(() => null as ContextWindowData | null),
    ]);

  // ── Derived signals ─────────────────────────────────────────────────────────
  const hour = parseInt(temporal.localTime.split(":")[0] ?? "12", 10);
  const isWeekend = temporal.dayOfWeek === "Saturday" || temporal.dayOfWeek === "Sunday";

  const lastActivity = plan.currentActivity;
  const lastActivityAge = lastActivity
    ? (now.getTime() - lastActivity.createdAt.getTime()) / 60_000
    : null;
  const isInFocusSession =
    !!lastActivity &&
    (lastActivity.category === "WORK" || lastActivity.category === "TALAL_OS") &&
    (lastActivityAge ?? 999) < 30;

  // Upcoming event: use readiness plans (have full datetime)
  const soonestPlan = readinessPlans[0] ?? null;
  const nextEventHoursAway = soonestPlan
    ? (soonestPlan.scheduledFor.getTime() - now.getTime()) / 3_600_000
    : null;
  const hasUpcomingEventSoon =
    nextEventHoursAway !== null && nextEventHoursAway >= 0 && nextEventHoursAway <= 3;

  // Active event: started within the last 2 hours
  const activePlan = readinessPlans.find((rp) => {
    const msSinceStart = now.getTime() - rp.scheduledFor.getTime();
    return msSinceStart >= 0 && msSinceStart < 2 * 3_600_000;
  }) ?? null;
  const hasActiveEvent = !!activePlan;

  // ── Life State Engine ───────────────────────────────────────────────────────
  const lifeState = await getActiveLifeState(userId, {
    now,
    hour,
    isoDate: temporal.isoDate,
    isWeekend,
    recoveryMode: plan.recoveryMode,
    isInFocusSession,
    currentActivityCategory: lastActivity?.category ?? null,
    currentActivityTitle: lastActivity?.activity ?? null,
    lastActivityAge,
    hasUpcomingEventSoon,
    hasActiveEvent,
    activeEventTitle: activePlan?.title ?? null,
    nextEventTitle: soonestPlan?.title ?? nextEvents[0]?.title ?? null,
    nextEventHoursAway,
    hasDueLearning: plan.dueLearningItems.length > 0,
  });

  // ── Derived content ─────────────────────────────────────────────────────────
  const contextChips = buildContextChips(plan, userState, nextEvents, temporal.isoDate);
  const question = oneQuestion ?? (plan.todaysQuestions[0] ? {
    id: plan.todaysQuestions[0].id,
    question: plan.todaysQuestions[0].question,
    reason: plan.todaysQuestions[0].reason ?? null,
    status: "OPEN" as const,
  } : null);
  const rightNow = buildRightNow(plan);
  const greeting = buildGreeting(firstName, hour, plan, lifeState, nextEvents);
  const lifeFeed = buildLifeFeed(lifeTimeline, plan.todayActivityLogs);

  const hasTodayEvents = nextEvents.some(
    (ev) => ev.date.toISOString().split("T")[0] === temporal.isoDate,
  );

  // ── Section layout (Life State Router) ──────────────────────────────────────
  const hasContextWindow = !!(
    contextWindow &&
    (contextWindow.previous || contextWindow.next) &&
    contextWindow.bridgeRecommendation
  );

  const sections = getStateLayout(lifeState, {
    hasTopTask: !!rightNow,
    hasReadinessPlans: readinessPlans.length > 0,
    hasQuestion: !!question,
    hasLifeFeed: lifeFeed.length > 0,
    hasTodayEvents,
    hasContextChips: contextChips.length > 0,
    hasDueLearning: plan.dueLearningItems.length > 0,
    hasContextWindow,
  });

  // ── Section JSX map ─────────────────────────────────────────────────────────
  const sectionJSX: Record<SectionId, React.ReactNode> = {

    greeting: (
      <section key="greeting" className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {greeting.headline}
        </h1>
        {greeting.subline && (
          <p className="text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            {greeting.subline}
          </p>
        )}
        {greeting.note && (
          <p className="text-sm text-neutral-400 dark:text-neutral-500">{greeting.note}</p>
        )}
      </section>
    ),

    context: contextChips.length > 0 ? (
      <section key="context">
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
    ) : null,

    capture: (
      <section key="capture">
        <HomeCapture mode={lifeState} />
      </section>
    ),

    right_now: rightNow ? (
      <section key="right_now">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          {lifeState === "FOCUS" ? "Focus" : "Right Now"}
        </p>
        <RightNowCard item={rightNow} />
      </section>
    ) : null,

    getting_ready: readinessPlans.length > 0 ? (
      <section key="getting_ready">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Getting Ready
        </p>
        <div className="space-y-3">
          {readinessPlans.map((rp) => (
            <ReadinessCard key={rp.id} plan={rp} now={now} />
          ))}
        </div>
      </section>
    ) : null,

    todays_schedule: (
      <TodaysSchedule key="todays_schedule" events={nextEvents} isoDate={temporal.isoDate} />
    ),

    one_question: question ? (
      <section key="one_question">
        <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900">
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
            Answer
          </Link>
        </div>
      </section>
    ) : null,

    reflection_prompt: (
      <ReflectionCard key="reflection_prompt" plan={plan} />
    ),

    life_feed: lifeFeed.length > 0 ? (
      <section key="life_feed">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
          Life Feed
        </p>
        <div className="space-y-0">
          {lifeFeed.map((item, i) => (
            <div key={i} className="flex items-start gap-4 py-3 first:pt-0">
              <span className="mt-0.5 w-12 shrink-0 text-right text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                {formatTime(item.time)}
              </span>
              <div className="min-w-0 flex-1">
                <span className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {item.text}
                </span>
                {item.tag && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">{item.tag}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null,

    recovery_guide: (
      <RecoveryGuide key="recovery_guide" plan={plan} />
    ),

    break_guide: (
      <BreakGuide key="break_guide" />
    ),

    learning_review: (
      <LearningReview key="learning_review" plan={plan} />
    ),

    social_guide: (
      <SocialGuide key="social_guide" nextEvent={nextEvents[0] ?? null} />
    ),

    ceo_review: (
      <CeoReview key="ceo_review" plan={plan} />
    ),

    now_flow: contextWindow ? (
      <NowFlow key="now_flow" data={contextWindow} />
    ) : null,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-12 px-4 pb-24 pt-8 sm:pt-14">
      {sections.map((id) => sectionJSX[id])}
    </div>
  );
}

// ── Data builders ─────────────────────────────────────────────────────────────

function buildGreeting(
  firstName: string,
  hour: number,
  plan: DailyPlan,
  lifeState: string,
  nextEvents: EventPlaceholder[],
): { headline: string; subline: string; note?: string } {
  const timeGreeting =
    hour < 5 ? "Still up," :
    hour < 12 ? "Good morning," :
    hour < 17 ? "Good afternoon," :
    hour < 21 ? "Good evening," : "Good night,";

  if (lifeState === "RECOVERY") {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Take care of yourself first.",
      note: "One small thing done is enough.",
    };
  }

  if (lifeState === "BREAK") {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Good session. Take a proper break.",
    };
  }

  if (lifeState === "ACTIVE_EVENT") {
    const event = nextEvents[0];
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: event ? `You're in: ${event.title}.` : "You're in an event.",
      note: "Capture anything important after.",
    };
  }

  if (lifeState === "SOCIAL") {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Social time. Be fully present.",
    };
  }

  if (lifeState === "LEARNING") {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Learning session. Make it count.",
    };
  }

  if (lifeState === "CEO_REVIEW") {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: "Time to review the bigger picture.",
    };
  }

  if (lifeState === "FOCUS") {
    const lastActivity = plan.currentActivity;
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: lastActivity
        ? `You're in a session: ${lastActivity.activity.toLowerCase()}.`
        : "You're in a focus session.",
      note: plan.topTasks[0] ? `Continue: ${plan.topTasks[0].title}.` : "Keep going.",
    };
  }

  // PREPARATION, REFLECTION, MORNING, DEFAULT
  const soonEvent = nextEvents[0];
  if (soonEvent && lifeState === "PREPARATION") {
    const label = soonEvent.time ? `${soonEvent.title} at ${soonEvent.time}` : soonEvent.title;
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `${label} is coming up.`,
      note: "Keep today simple.",
    };
  }

  if (plan.recentReflection?.accomplished && hour < 14) {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `Yesterday: ${truncate(plan.recentReflection.accomplished, 80)}.`,
      note: "Let's keep going.",
    };
  }

  if (plan.topTasks[0]) {
    const project = plan.topTasks[0].project?.name;
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: project
        ? `Let's continue building ${project}.`
        : `Let's continue: ${plan.topTasks[0].title}.`,
    };
  }

  if (plan.habitsDue.length > 0) {
    return {
      headline: `${timeGreeting} ${firstName}.`,
      subline: `${plan.habitsDue.length} habit${plan.habitsDue.length > 1 ? "s" : ""} to keep today.`,
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
  if (mission) chips.push({ label: "Chapter", value: truncate(mission, 30) });

  const topProject = plan.topTasks[0]?.project?.name;
  if (topProject) chips.push({ label: "Project", value: truncate(topProject, 24) });

  if (userState?.energyLevel) {
    const map: Record<string, string> = { LOW: "Low energy", MEDIUM: "Normal", HIGH: "High energy" };
    chips.push({ label: "Energy", value: map[userState.energyLevel] ?? userState.energyLevel });
  }

  if (userState?.currentMood) {
    chips.push({ label: "Mood", value: truncate(userState.currentMood, 20) });
  }

  const nextEvent = nextEvents[0];
  if (nextEvent) {
    const isToday = nextEvent.date.toISOString().split("T")[0] === isoDate;
    const value = nextEvent.time
      ? `${nextEvent.title} ${nextEvent.time}${isToday ? "" : " tomorrow"}`
      : `${nextEvent.title}${isToday ? "" : " tomorrow"}`;
    chips.push({ label: "Next", value: truncate(value, 28) });
  }

  return chips.slice(0, 5);
}

function buildRightNow(plan: DailyPlan): RightNowItem | null {
  if (plan.topTasks[0]) {
    return {
      type: "task",
      id: plan.topTasks[0].id,
      verb: "Continue",
      title: plan.topTasks[0].title,
      project: plan.topTasks[0].project?.name ?? null,
      reason: plan.suggestion || null,
      href: "/tasks",
    };
  }
  if (plan.habitsDue[0]) {
    return {
      type: "habit",
      id: plan.habitsDue[0].id,
      verb: "Complete",
      title: plan.habitsDue[0].name,
      project: null,
      reason: "Part of your daily routine.",
      href: "/habits",
    };
  }
  if (plan.dueLearningItems[0]) {
    return {
      type: "learning",
      id: plan.dueLearningItems[0].id,
      verb: "Review",
      title: plan.dueLearningItems[0].title,
      project: null,
      reason: "Your learning is due for review.",
      href: "/learn/review",
    };
  }
  return null;
}

const ENTITY_TYPE_TAGS: Record<string, string> = {
  TASK: "Task", PROJECT: "Project", PERSON: "People", THOUGHT: "Thought",
  MEMORY: "Memory", LEARNING: "Learning", HABIT: "Habit",
  JOURNAL: "Journal", EVENT: "Event", CAPTURE: "Capture",
};

const ACTIVITY_CATEGORY_TAGS: Record<string, string> = {
  WORK: "Work", DANCE: "Dance", FITNESS: "Fitness",
  LEARNING: "Learning", SOCIAL: "Social", TALAL_OS: "Talal OS",
};

function buildLifeFeed(
  lifeTimeline: LifeTimelineEntry[],
  activityLogs: ActivityLogSummary[],
): Array<{ time: Date; text: string; tag?: string }> {
  const timelineItems = lifeTimeline.map((e) => ({
    time: e.occurredAt,
    text: e.title,
    tag: ENTITY_TYPE_TAGS[e.entityType] ?? undefined,
  }));

  const activityItems = activityLogs
    .filter((a) => !lifeTimeline.some(
      (t) => Math.abs(t.occurredAt.getTime() - a.createdAt.getTime()) < 60_000,
    ))
    .map((a) => ({
      time: a.createdAt,
      text: a.activity,
      tag: ACTIVITY_CATEGORY_TAGS[a.category] ?? undefined,
    }));

  return [...timelineItems, ...activityItems]
    .sort((a, b) => a.time.getTime() - b.time.getTime())
    .slice(-8);
}

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

// Keep LIFE_STATE_LABELS imported to avoid dead-import warning (used for future API)
void LIFE_STATE_LABELS;
