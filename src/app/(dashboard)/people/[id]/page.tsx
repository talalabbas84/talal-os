import { notFound } from "next/navigation";
import { getPerson } from "@/features/people/actions/people.actions";
import { PersonDetailView } from "@/features/people/components/person-detail-view";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPerson(id);
  if (!result.success) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PersonDetailView person={result.data} />
    </div>
  );
}
