import { redirect } from "next/navigation";
import { PulseView } from "@/features/pulse/components/pulse-view";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Day Pulse — Talal OS" };

export default async function PulsePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [pendingPulse, recentActivities] = await Promise.all([
    prisma.dayPulse.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: "asc" },
    }),
    prisma.activityLog.findMany({
      where: {
        userId: session.user.id,
        createdAt: { gte: today, lt: tomorrow },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="p-6 pb-32 md:pb-6">
      <PulseView pendingPulse={pendingPulse} recentActivities={recentActivities} />
    </div>
  );
}
