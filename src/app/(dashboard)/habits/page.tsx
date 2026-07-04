import { getHabits } from "@/features/habits/actions/habit.actions";
import { HabitListView } from "@/features/habits/components/habit-list-view";
import { HabitDialog } from "@/features/habits/components/habit-dialog";

export default async function HabitsPage() {
  const habits = await getHabits();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Habits
        </h1>
        <HabitDialog />
      </div>
      <HabitListView habits={habits} />
    </div>
  );
}
