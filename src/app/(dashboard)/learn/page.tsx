import { redirect } from "next/navigation";
import { getDueLearningItems } from "@/features/learn/actions/learn.actions";
import { LearningView } from "@/features/learn/components/learning-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Learn — Talal OS" };

export default async function LearnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [dueItems, allItems] = await Promise.all([
    getDueLearningItems(session.user.id, 5),
    prisma.learningItem.findMany({
      where: { userId: session.user.id },
      orderBy: [{ nextReviewAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  return (
    <div className="p-6 pb-32 md:pb-6">
      <LearningView dueItems={dueItems} allItems={allItems} />
    </div>
  );
}
