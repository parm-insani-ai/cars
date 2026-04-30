"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConsentToggle({
  customerId,
  smsConsent,
  emailConsent,
}: {
  customerId: string;
  smsConsent: boolean;
  emailConsent: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  async function toggle(field: "smsConsent" | "emailConsent", value: boolean) {
    setBusy(true);
    await fetch("/api/actions/customer-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, field, value }),
    });
    setBusy(false);
    start(() => router.refresh());
  }

  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <h2 className="font-medium">TCPA consent</h2>
        <p className="text-xs text-ink-muted">
          Required by law for outbound SMS. Toggle requires the customer's verbal or written opt-in.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className={smsConsent ? "chip-cool" : "chip-muted"}
          onClick={() => toggle("smsConsent", !smsConsent)}
          disabled={busy}
        >
          SMS {smsConsent ? "yes" : "no"}
        </button>
        <button
          className={emailConsent ? "chip-cool" : "chip-muted"}
          onClick={() => toggle("emailConsent", !emailConsent)}
          disabled={busy}
        >
          Email {emailConsent ? "yes" : "no"}
        </button>
      </div>
    </div>
  );
}
