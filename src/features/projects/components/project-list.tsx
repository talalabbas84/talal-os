"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FolderKanban, Pencil, Trash2 } from "lucide-react";
import {
  deleteProject,
  updateProjectStatus,
} from "@/features/projects/actions/project.actions";
import { ProjectDialog } from "./project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateShort } from "@/utils/date";
import type { Project, ProjectStatus } from "@/types";

type ProjectWithCount = Project & { _count: { tasks: number } };

const statusConfig: Record<
  ProjectStatus,
  { label: string; variant: "default" | "secondary" | "success" | "warning" | "outline" }
> = {
  ACTIVE: { label: "Active", variant: "success" },
  BACKLOG: { label: "Backlog", variant: "secondary" },
  PAUSED: { label: "Paused", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "outline" },
};

const statusOrder: ProjectStatus[] = ["ACTIVE", "BACKLOG", "PAUSED", "COMPLETED"];

function ProjectCard({ project }: { project: ProjectWithCount }) {
  const [, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);

  if (deleted) return null;

  const s = statusConfig[project.status];

  function handleDelete() {
    if (!confirm("Delete this project and all its tasks?")) return;
    setDeleted(true);
    startTransition(async () => {
      await deleteProject(project.id);
    });
  }

  function handleStatus(status: string) {
    startTransition(async () => {
      await updateProjectStatus(project.id, status as ProjectStatus);
    });
  }

  return (
    <div className="group rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/projects/${project.id}`}
          className="min-w-0 flex-1 space-y-1"
        >
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0 text-neutral-400" />
            <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">
              {project.name}
            </p>
          </div>
          {project.description && (
            <p className="text-sm text-neutral-500 line-clamp-2">
              {project.description}
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-neutral-400">
              {project._count.tasks} task{project._count.tasks !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-neutral-400">
              {formatDateShort(project.createdAt)}
            </span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <Select value={project.status} onValueChange={handleStatus}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOrder.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {statusConfig[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <ProjectDialog
              project={project}
              trigger={
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const filterTabs: { label: string; value: ProjectStatus | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Backlog", value: "BACKLOG" },
  { label: "Paused", value: "PAUSED" },
  { label: "Completed", value: "COMPLETED" },
];

export function ProjectList({ projects }: { projects: ProjectWithCount[] }) {
  const [filter, setFilter] = useState<ProjectStatus | "ALL">("ALL");

  const filtered =
    filter === "ALL" ? projects : projects.filter((p) => p.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-400">
          No projects yet
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
