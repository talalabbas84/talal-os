import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{today}</p>
      {session?.user?.name && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {session.user.name}
        </p>
      )}
    </header>
  );
}
