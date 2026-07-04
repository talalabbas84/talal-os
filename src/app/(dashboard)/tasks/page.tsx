import { getTasks } from "@/features/tasks/actions/task.actions";
import { getProjects } from "@/features/projects/actions/project.actions";
import { TaskListView } from "@/features/tasks/components/task-list-view";
import { TaskDialog } from "@/features/tasks/components/task-dialog";

export default async function TasksPage() {
  const [tasks, projects] = await Promise.all([
    getTasks(),
    getProjects("ACTIVE"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Tasks
        </h1>
        <TaskDialog />
      </div>
      <TaskListView tasks={tasks} />
    </div>
  );
}
