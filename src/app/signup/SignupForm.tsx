"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [yourName, setYourName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, yourName, email, password }),
    });
    if (res.status === 409) {
      setError("An account with that email already exists. Try signing in instead.");
      setBusy(false);
      return;
    }
    if (!res.ok) {
      setError("Something went wrong. Check your details and try again.");
      setBusy(false);
      return;
    }
    router.push("/onboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs text-ink-muted">Business name</label>
        <input
          className="input w-full mt-1"
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="e.g. Atlantic Auto Detail"
          required
        />
      </div>
      <div>
        <label className="text-xs text-ink-muted">Your name</label>
        <input
          className="input w-full mt-1"
          value={yourName}
          onChange={e => setYourName(e.target.value)}
          placeholder="First and last"
          required
          autoComplete="name"
        />
      </div>
      <div>
        <label className="text-xs text-ink-muted">Work email</label>
        <input
          type="email"
          className="input w-full mt-1"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="text-xs text-ink-muted">Password</label>
        <input
          type="password"
          className="input w-full mt-1"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-[11px] text-ink-muted mt-1">At least 8 characters.</p>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
