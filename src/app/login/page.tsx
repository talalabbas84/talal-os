import { LoginForm } from "@/features/auth/components/login-form";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 px-4 py-8 dark:bg-neutral-950">
      <div className="w-full max-w-sm space-y-8 px-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Talal OS
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Your personal operating system
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
