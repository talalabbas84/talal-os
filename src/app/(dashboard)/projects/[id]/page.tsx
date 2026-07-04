import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getProject } from "@/features/projects/actions/project.actions";
import { ProjectDialog } from "@/features/projects/components/project-dialog";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { ProjectTaskList } from "@/features/projects/components/project-task-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/date";

const statusVariant: Record<string, "success" | "secondary" | "warning" | "outline"> = {
  ACTIVE: "success",
  BACKLOG: "secondary",
  PAUSED: "warning",
  COMPLETED: "outline",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="gap-1 pl-1">
            <ChevronLeft className="h-4 w-4" />
            Projects
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              {project.name}
            </h1>
            <Badge variant={statusVariant[project.status]}>
              {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
            </Badge>
          </div>
          {project.description && (
            <p className="text-sm text-neutral-500">{project.description}</p>
          )}
          <p className="text-xs text-neutral-400">
            Created {formatDate(project.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <ProjectDialog
            project={project}
            trigger={
              <Button variant="outline" size="sm">
                Edit
              </Button>
            }
          />
          <TaskDialog projectId={project.id} />
        </div>
      </div>

      <ProjectTaskList tasks={project.tasks} projectId={project.id} />
    </div>
  );
}
