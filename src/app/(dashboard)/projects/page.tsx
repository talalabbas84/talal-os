import { getProjects } from "@/features/projects/actions/project.actions";
import { ProjectList } from "@/features/projects/components/project-list";
import { ProjectDialog } from "@/features/projects/components/project-dialog";

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Projects
        </h1>
        <ProjectDialog />
      </div>
      <ProjectList projects={projects} />
    </div>
  );
}
