import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CaptureView } from "@/features/capture/components/capture-view";

export const metadata = { title: "Capture — Talal OS" };

export default async function CapturePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="p-6 pb-32 md:pb-6">
      <CaptureView userName={session.user.name ?? "Talal"} />
    </div>
  );
}
