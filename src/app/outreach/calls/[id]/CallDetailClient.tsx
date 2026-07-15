"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Client-side glue for the call detail page:
//   * An <audio> element the parent can bind transcript-turn timestamps to,
//     so clicking a turn seeks the recording to that moment.
//   * "Mark do not call" button that hits the existing prospect suppress API.
// Kept in one component because they share the same page shell.

export function CallRecordingPlayer({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  return (
    <audio
      ref={ref}
      controls
      src={src}
      className="w-full"
      onLoadedMetadata={() => {
        // Expose the element globally so transcript rows can seek it. This is
        // simpler than lifting state through the server-rendered tree — the
        // parent page renders once and the audio element is stable.
        (window as unknown as { __callAudio?: HTMLAudioElement }).__callAudio = ref.current ?? undefined;
      }}
    />
  );
}

export function TurnSeekButton({ seconds, children }: { seconds: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="hover:underline"
      onClick={() => {
        const a = (window as unknown as { __callAudio?: HTMLAudioElement }).__callAudio;
        if (a) {
          a.currentTime = seconds;
          a.play().catch(() => undefined);
        }
      }}
    >
      {children}
    </button>
  );
}

export function ProspectActionsInline({
  prospectId,
  doNotCall,
}: {
  prospectId: string;
  doNotCall: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const op = doNotCall ? "unsuppress" : "suppress";
    if (op === "suppress" && !confirm("Add this business to the do-not-call list? All pending calls to this number will be cancelled.")) return;
    setBusy(true);
    await fetch("/api/outreach/actions/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prospectId, op }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className={doNotCall ? "btn-secondary text-xs" : "btn-danger text-xs"}
      onClick={toggle}
      disabled={busy}
    >
      {doNotCall ? "Remove from DNC" : "Mark do not call"}
    </button>
  );
}
