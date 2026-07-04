import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Project } from "@/types";

type ProjectWithCount = Project & { _count: { tasks: number } };

const priorityLabel: Record<string, { label: string; variant: "default" | "warning" | "destructive" | "secondary" }> = {
  URGENT: { label: "Urgent", variant: "destructive" },
  HIGH: { label: "High", variant: "warning" },
  MEDIUM: { label: "Medium", variant: "secondary" },
  LOW: { label: "Low", variant: "secondary" },
};

export function DashboardProjectList({
  projects,
}: {
  projects: ProjectWithCount[];
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">
          Active Projects
        </CardTitle>
        <Link
          href="/projects"
          className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-700"
        >
          All <ArrowRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {projects.length === 0 ? (
          <p className="py-4 text-center text-sm text-neutral-400">
            No active projects
          </p>
        ) : (
          projects.map((project) => {
            const p = priorityLabel[project.priority];
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 rounded-md p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <FolderKanban className="h-4 w-4 shrink-0 text-neutral-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{project.name}</p>
                  <p className="text-xs text-neutral-400">
                    {project._count.tasks} task
                    {project._count.tasks !== 1 ? "s" : ""}
                  </p>
                </div>
                <Badge variant={p.variant} className="shrink-0 text-xs">
                  {p.label}
                </Badge>
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
