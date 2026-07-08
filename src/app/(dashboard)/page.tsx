import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock,
  HelpCircle,
  Inbox,
  MessageCircle,
  Moon,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateTodayButton } from "@/features/dashboard/components/generate-today-button";
import { DashboardTopTasks } from "@/features/dashboard/components/dashboard-top-tasks";
import { TodaysConversationCard } from "@/features/conversation/components/todays-conversation-card";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateTodaysConversation } from "@/lib/conversation";
import { buildDailyPlan } from "@/lib/planning/daily-plan";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const plan = await buildDailyPlan(session.user.id);
  const personalIntelligence = await getPersonalIntelligenceSummary(session.user.id);
  const todaysConversation = await getOrCreateTodaysConversation(session.user.id);
  const conversationStats = await getConversationStats(session.user.id);
  const firstName = session.user.name?.split(" ")[0] ?? "Talal";
  const showReflectionReminder = !plan.journalFilled && getHourInTimeZone("America/Toronto") >= 20;
  const nextAction = plan.topTasks[0]?.title ?? plan.habitsDue[0]?.name ?? "Capture what is on your mind.";

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-20 sm:space-y-6">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              <Sparkles className="h-4 w-4" />
              Good Morning
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-neutral-50">
              {firstName}, do this now:
            </h1>
            <p className="max-w-2xl text-lg text-neutral-700 dark:text-neutral-300">
              {nextAction}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/capture">Capture</Link>
            </Button>
            <GenerateTodayButton />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Signal label="Focus" value={plan.focusMode ?? "Normal execution"} icon={Zap} />
          <Signal label="Inbox" value={`${plan.inboxCount} pending`} icon={Inbox} />
          <Signal label="Mode" value={plan.recoveryMode ? "Recovery" : "Execution"} icon={Moon} />
        </div>
      </section>

      {showReflectionReminder && <ReflectionReminder />}

      <TodaysConversationCard
        conversation={todaysConversation ? {
          id: todaysConversation.id,
          mode: todaysConversation.mode,
          slot: todaysConversation.slot,
          prompt: todaysConversation.prompt,
          contextNote: todaysConversation.contextNote,
        } : null}
        totalXp={conversationStats.totalXp}
        streak={conversationStats.streak}
      />

      <PersonalIntelligencePanel summary={personalIntelligence} todayFocus={plan.todayMission} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <Brain className="h-4 w-4" />
                Companion Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {plan.summary}
              </p>
              {plan.ideasToIgnore.length > 0 && (
                <div className="mt-4 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Ideas to ignore until the Top 3 are done
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {plan.ideasToIgnore.map((idea) => (
                      <li key={idea}>• {idea}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <Target className="h-4 w-4" />
                Today&apos;s Mission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold leading-8 text-neutral-950 dark:text-neutral-50">
                {plan.todayMission}
              </p>
              <p className="mt-3 text-sm text-neutral-500">{plan.suggestion}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <HelpCircle className="h-4 w-4" />
                Today&apos;s Questions
              </CardTitle>
              <span className="text-xs text-neutral-400">max 3</span>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.todaysQuestions.length === 0 ? (
                <EmptyLine text="No follow-up questions today." />
              ) : (
                plan.todaysQuestions.map((question) => (
                  <div key={question.id} className="rounded-xl border border-neutral-100 p-3 dark:border-neutral-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-50">
                          {question.question}
                        </p>
                        {question.reason && (
                          <p className="mt-1 text-xs leading-5 text-neutral-500">{question.reason}</p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800">
                        {formatCategory(question.category)}
                      </span>
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link href={`/capture?question=${question.id}`}>Answer in Capture</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <BookOpen className="h-4 w-4" />
                Today&apos;s Review
              </CardTitle>
              <Button asChild variant="outline" size="sm" disabled={plan.dueLearningItems.length === 0}>
                <Link href="/learn/review">Start Review</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.dueLearningItems.length === 0 ? (
                <EmptyLine text="No learning reviews due." />
              ) : (
                plan.dueLearningItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/learn/review"
                    className="flex items-center justify-between rounded-lg bg-neutral-50 p-3 text-sm hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                  >
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">{item.title}</span>
                    <span className="text-xs text-neutral-400">{formatCategory(item.category)}</span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <DashboardTopTasks tasks={plan.topTasks} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <Activity className="h-4 w-4" />
                Day Pulse
              </CardTitle>
              <Button asChild size="sm">
                <Link href="/pulse">Check In Now</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {plan.pendingPulse && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">{plan.pendingPulse.prompt}</p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Scheduled {formatTime(plan.pendingPulse.scheduledFor)}
                  </p>
                </div>
              )}
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Current activity</p>
                <p className="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-50">
                  {plan.currentActivity?.activity ?? "No activity logged yet."}
                </p>
                {plan.currentActivity && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatCategory(plan.currentActivity.category)} · {formatTime(plan.currentActivity.createdAt)}
                  </p>
                )}
              </div>
              <p className="text-xs text-neutral-500">
                {plan.todayActivityCount} activit{plan.todayActivityCount === 1 ? "y" : "ies"} logged today.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Remaining Habits
              </CardTitle>
              <Link href="/habits" className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
                All <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.habitsDue.length === 0 ? (
                <EmptyLine text="Habits are clear." />
              ) : (
                plan.habitsDue.map((habit) => (
                  <div key={habit.id} className="flex items-center gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                    <CheckCircle2 className="h-4 w-4 text-neutral-300" />
                    <span className="text-sm text-neutral-800 dark:text-neutral-200">{habit.name}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-neutral-500">
                People Follow-up
              </CardTitle>
              <Link href="/people" className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700">
                People <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.peopleToFollowUp.length === 0 ? (
                <EmptyLine text="No relationship follow-ups today." />
              ) : (
                plan.peopleToFollowUp.map((item) => (
                  <div key={item} className="rounded-lg border border-neutral-100 p-3 dark:border-neutral-800">
                    <p className="text-sm text-neutral-800 dark:text-neutral-200">{item}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Inbox Count
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href="/inbox"
                className="flex items-center justify-between rounded-xl bg-neutral-50 p-4 transition-colors hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
              >
                <div>
                  <p className="text-3xl font-semibold text-neutral-950 dark:text-neutral-50">
                    {plan.inboxCount}
                  </p>
                  <p className="text-sm text-neutral-500">pending captures</p>
                </div>
                <Inbox className="h-5 w-5 text-neutral-400" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Capture
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full justify-between" size="lg">
                <Link href="/capture">
                  Capture raw thought
                  <MessageCircle className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Messy wording is expected. Talal OS will articulate it before organizing anything.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-neutral-500">
                Recent Reflection
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plan.recentReflection ? (
                <div className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                  {plan.recentReflection.feeling && <p>Feeling: {plan.recentReflection.feeling}</p>}
                  {plan.recentReflection.accomplished && <p>Went well: {plan.recentReflection.accomplished}</p>}
                  {plan.recentReflection.improve && <p>Next improvement: {plan.recentReflection.improve}</p>}
                </div>
              ) : (
                <EmptyLine text="No reflection saved yet." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                <Clock className="h-4 w-4" />
                Today&apos;s Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.todayActivityLogs.length === 0 ? (
                <EmptyLine text="No activity timeline yet." />
              ) : (
                plan.todayActivityLogs.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                    <span className="mt-0.5 text-xs text-neutral-400">{formatTime(activity.createdAt)}</span>
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{activity.activity}</p>
                      <p className="text-xs text-neutral-500">{formatCategory(activity.category)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function getPersonalIntelligenceSummary(userId: string) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const [
    reflectionQuestion,
    recentPersonalInsight,
    growthArea,
    insightCount,
    timelineCount,
    reviewCount,
  ] = await Promise.all([
    prisma.reflectionQuestion.findFirst({
      where: { userId, status: "OPEN" },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    }),
    prisma.personalInsight.findFirst({
      where: { userId },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    }),
    prisma.personalGrowthArea.findFirst({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }],
    }),
    prisma.personalInsight.count({ where: { userId, createdAt: { gte: weekStart } } }),
    prisma.timelineEvent.count({ where: { userId, createdAt: { gte: weekStart } } }),
    prisma.learningItem.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
  ]);

  return {
    reflectionQuestion,
    recentPersonalInsight,
    growthArea,
    weeklyProgress: `${insightCount} insights · ${timelineCount} life events`,
    upcomingReviews: `${reviewCount} due`,
    currentChallenge: growthArea?.currentChallenge ?? "No current challenge captured yet.",
    todayRecommendation: growthArea?.nextRecommendation ?? "Capture the next raw thought before trying to organize it.",
  };
}

async function getConversationStats(userId: string) {
  const [xp, streak] = await Promise.all([
    prisma.discoveryXp.aggregate({
      where: { userId },
      _sum: { xp: true },
    }),
    prisma.companionStreak.findUnique({
      where: { userId_type: { userId, type: "MEANINGFUL_CONVERSATION" } },
      select: { currentCount: true },
    }),
  ]);

  return {
    totalXp: xp._sum.xp ?? 0,
    streak: streak?.currentCount ?? 0,
  };
}

function PersonalIntelligencePanel({
  summary,
  todayFocus,
}: {
  summary: Awaited<ReturnType<typeof getPersonalIntelligenceSummary>>;
  todayFocus: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          <Brain className="h-4 w-4" />
          Personal Intelligence
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IntelligenceItem label="Today's Focus" value={todayFocus} />
        <IntelligenceItem
          label="Today's Reflection Question"
          value={summary.reflectionQuestion?.question ?? "No reflection question pending."}
        />
        <IntelligenceItem
          label="Current Growth Momentum"
          value={summary.growthArea ? formatCategory(summary.growthArea.momentum) : "No momentum captured yet."}
        />
        <IntelligenceItem
          label="Recent Personal Insight"
          value={summary.recentPersonalInsight?.title ?? "No personal insight captured yet."}
        />
        <IntelligenceItem label="Current Challenge" value={summary.currentChallenge} />
        <IntelligenceItem label="Today's Recommendation" value={summary.todayRecommendation} />
        <IntelligenceItem label="Weekly Progress" value={summary.weeklyProgress} />
        <IntelligenceItem label="Upcoming Reviews" value={summary.upcomingReviews} />
        <IntelligenceItem label="Learning Review" value={summary.upcomingReviews} />
      </CardContent>
    </Card>
  );
}

function IntelligenceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 line-clamp-3 text-sm leading-6 text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  );
}

function Signal({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-sm font-medium text-neutral-800 dark:text-neutral-200">{value}</p>
    </div>
  );
}

function ReflectionReminder() {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
            <BookOpen className="h-4 w-4" />
            Today&apos;s Reflection Missing
          </div>
          <p className="mt-2 text-sm leading-6 text-amber-800/80 dark:text-amber-200/80">
            What went well? What was difficult? What did you learn?
          </p>
        </div>
        <Button asChild variant="outline" className="border-amber-300 bg-white dark:border-amber-800 dark:bg-neutral-950">
          <Link href="/capture">Capture reflection</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-3 text-center text-sm text-neutral-400">{text}</p>;
}

function formatCategory(category: string): string {
  return category.toLowerCase().replace(/_/g, " ");
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function getHourInTimeZone(timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(hour);
}
