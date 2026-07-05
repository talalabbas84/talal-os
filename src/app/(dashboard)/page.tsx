import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTodayTasks, getTopTasks } from "@/features/tasks/actions/task.actions";
import { getProjects } from "@/features/projects/actions/project.actions";
import { getInboxEntries } from "@/features/inbox/actions/inbox.actions";
import { getTodayHabits } from "@/features/habits/actions/habit.actions";
import { DashboardTaskList } from "@/features/dashboard/components/dashboard-task-list";
import { DashboardProjectList } from "@/features/dashboard/components/dashboard-project-list";
import { DashboardInboxList } from "@/features/dashboard/components/dashboard-inbox-list";
import { DashboardHabitList } from "@/features/dashboard/components/dashboard-habit-list";
import { DashboardTopTasks } from "@/features/dashboard/components/dashboard-top-tasks";
import { DashboardDailySummary } from "@/features/dashboard/components/dashboard-daily-summary";
import { QuickAdd } from "@/features/dashboard/components/quick-add";
import { buildDailyPlan } from "@/lib/planning/daily-plan";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [todayTasks, topTasks, activeProjects, recentInbox, todayHabits, dailyPlan] =
    await Promise.all([
      getTodayTasks(),
      getTopTasks(3),
      getProjects("ACTIVE"),
      getInboxEntries("PENDING"),
      getTodayHabits(),
      buildDailyPlan(session.user.id),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Dashboard
        </h1>
        <QuickAdd />
      </div>

      <DashboardDailySummary plan={dailyPlan} />
      <DashboardTopTasks tasks={topTasks} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTaskList tasks={todayTasks} />
        <DashboardProjectList projects={activeProjects} />
        <DashboardInboxList entries={recentInbox.slice(0, 5)} />
        <DashboardHabitList habits={todayHabits} />
      </div>
    </div>
  );
}
