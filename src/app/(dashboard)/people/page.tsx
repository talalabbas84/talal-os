import { getPeople } from "@/features/people/actions/people.actions";
import { PeopleView } from "@/features/people/components/people-view";

export default async function PeoplePage() {
  const result = await getPeople();
  const people = result.success ? result.data : [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <PeopleView people={people} />
    </div>
  );
}
