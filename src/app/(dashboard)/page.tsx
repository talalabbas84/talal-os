import { getTodayTasks } from "@/features/tasks/actions/task.actions";
import { getProjects } from "@/features/projects/actions/project.actions";
import { getInboxEntries } from "@/features/inbox/actions/inbox.actions";
import { getTodayHabits } from "@/features/habits/actions/habit.actions";
import { DashboardTaskList } from "@/features/dashboard/components/dashboard-task-list";
import { DashboardProjectList } from "@/features/dashboard/components/dashboard-project-list";
import { DashboardInboxList } from "@/features/dashboard/components/dashboard-inbox-list";
import { DashboardHabitList } from "@/features/dashboard/components/dashboard-habit-list";
import { QuickAdd } from "@/features/dashboard/components/quick-add";

export default async function DashboardPage() {
  const [todayTasks, activeProjects, recentInbox, todayHabits] =
    await Promise.all([
      getTodayTasks(),
      getProjects("ACTIVE"),
      getInboxEntries("PENDING"),
      getTodayHabits(),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Dashboard
        </h1>
        <QuickAdd />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTaskList tasks={todayTasks} />
        <DashboardProjectList projects={activeProjects} />
        <DashboardInboxList entries={recentInbox.slice(0, 5)} />
        <DashboardHabitList habits={todayHabits} />
      </div>
    </div>
  );
}
