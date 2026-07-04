import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 pt-[env(safe-area-inset-top)] dark:border-neutral-800 dark:bg-neutral-950 md:h-16 md:px-6 md:pt-0">
      <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
        {today}
      </p>
      {session?.user?.name && (
        <p className="ml-3 truncate text-sm text-neutral-500 dark:text-neutral-400">
          {session.user.name}
        </p>
      )}
    </header>
  );
}
