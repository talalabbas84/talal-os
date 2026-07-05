import { redirect } from "next/navigation";
import { getDueLearningItems } from "@/features/learn/actions/learn.actions";
import { ReviewFlow } from "@/features/learn/components/review-flow";
import { auth } from "@/lib/auth";

export const metadata = { title: "Review — Talal OS" };

export default async function LearnReviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dueItems = await getDueLearningItems(session.user.id, 10);

  return (
    <div className="p-6 pb-32 md:pb-6">
      <ReviewFlow items={dueItems} />
    </div>
  );
}
