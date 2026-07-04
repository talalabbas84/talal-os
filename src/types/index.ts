import type {
  User,
  InboxEntry,
  Project,
  Task,
  DailyLog,
  Habit,
  HabitCompletion,
  InboxCategory,
  InboxStatus,
  ProjectStatus,
  Priority,
  TaskStatus,
  Frequency,
} from "@prisma/client";

export type {
  User,
  InboxEntry,
  Project,
  Task,
  DailyLog,
  Habit,
  HabitCompletion,
  InboxCategory,
  InboxStatus,
  ProjectStatus,
  Priority,
  TaskStatus,
  Frequency,
};

export type TaskWithProject = Task & {
  project: Project | null;
};

export type HabitWithCompletions = Habit & {
  completions: HabitCompletion[];
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
