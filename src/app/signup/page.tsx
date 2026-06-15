import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create your insani account",
  description: "Sign up for insani and have your AI employee answering calls within minutes.",
};

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 border-b border-surface-border">
        <Link href="/" className="font-semibold tracking-tight">insani</Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-2xl font-semibold">Create your account</h1>
            <p className="text-sm text-ink-muted mt-1">
              Five minutes to set up. Your AI employee starts answering calls today.
            </p>
          </div>
          <SignupForm />
          <p className="text-xs text-ink-muted text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-lane hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
