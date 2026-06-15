import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 border-b border-surface-border">
        <Link href="/" className="font-semibold tracking-tight">insani</Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Sign in to insani</h1>
            <p className="text-sm text-ink-muted mt-1">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-lane hover:underline">
                Create one
              </Link>
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
