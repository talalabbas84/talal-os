import type {
  Prisma,
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
  Prisma,
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

export type TaskWithProject = Prisma.TaskGetPayload<{
  include: { project: true };
}>;

export type HabitWithCompletions = Prisma.HabitGetPayload<{
  include: { completions: true };
}>;

export type ProjectWithTaskCount = Prisma.ProjectGetPayload<{
  include: { _count: { select: { tasks: true } } };
}>;

export type ProjectWithTasks = Prisma.ProjectGetPayload<{
  include: { tasks: true };
}>;

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };
