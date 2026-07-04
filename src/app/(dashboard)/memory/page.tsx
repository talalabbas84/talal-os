import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMemoryEntries } from "@/features/memory/actions/memory.actions";
import { MemoryView } from "@/features/memory/components/memory-view";

export default async function MemoryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const memories = await getMemoryEntries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Memory Vault
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Long-term context about who you are, what you believe, and what you&apos;ve learned.
        </p>
      </div>

      <MemoryView memories={memories} />
    </div>
  );
}
