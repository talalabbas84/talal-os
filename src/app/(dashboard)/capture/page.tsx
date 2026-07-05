import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CaptureView } from "@/features/capture/components/capture-view";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Capture — Talal OS" };

export default async function CapturePage({
  searchParams,
}: {
  searchParams?: Promise<{ question?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const question = params?.question && session.user.id
    ? await prisma.followUpQuestion.findFirst({
        where: { id: params.question, userId: session.user.id, status: "OPEN" },
      })
    : null;
  const initialText = question ? `Answer: ${question.question}\n\n` : "";

  return (
    <div className="p-6 pb-32 md:pb-6">
      <CaptureView userName={session.user.name ?? "Talal"} initialText={initialText} />
    </div>
  );
}
