import { redirect } from "next/navigation";
import { ThoughtVaultView } from "@/features/thoughts/components/thought-vault-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Thought Vault — Talal OS" };

export default async function ThoughtsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const thoughts = await prisma.thought.findMany({
    where: { userId: session.user.id },
    orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="p-6 pb-32 md:pb-6">
      <ThoughtVaultView thoughts={thoughts} />
    </div>
  );
}
