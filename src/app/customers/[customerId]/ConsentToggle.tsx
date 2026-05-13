"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConsentToggle({ customerId, smsConsent, emailConsent }: {
  customerId: string;
  smsConsent: boolean;
  emailConsent: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function toggle(field: "smsConsent" | "emailConsent", value: boolean) {
    setBusy(true);
    await fetch("/api/actions/customer-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, field, value }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h2 className="font-semibold">Permission to contact</h2>
        <p className="text-xs text-ink-muted mt-1">Required by law before we send any text messages.</p>
      </div>
      <div className="flex gap-2">
        <button className={smsConsent ? "chip-cool" : "chip-muted"} onClick={() => toggle("smsConsent", !smsConsent)} disabled={busy}>
          Text messages: {smsConsent ? "Opted in" : "Off"}
        </button>
        <button className={emailConsent ? "chip-cool" : "chip-muted"} onClick={() => toggle("emailConsent", !emailConsent)} disabled={busy}>
          Email: {emailConsent ? "Opted in" : "Off"}
        </button>
      </div>
    </div>
  );
}
