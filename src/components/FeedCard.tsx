import Link from "next/link";
import type { FeedCard } from "@/domain/feed";
import { formatDistanceToNowStrict } from "date-fns";

const kindLabel: Record<FeedCard["kind"], string> = {
  first_response: "New lead",
  followup: "Follow-up",
  missed_call_recovery: "Missed call",
  service_opp: "Service drive",
  equity_opp: "Equity",
  reactivation: "Reactivation",
  confirm_appointment: "Confirm appt",
  manual: "Manual",
};

const kindChip: Record<FeedCard["kind"], string> = {
  first_response: "chip-hot",
  missed_call_recovery: "chip-hot",
  service_opp: "chip-warm",
  equity_opp: "chip-warm",
  followup: "chip-cool",
  reactivation: "chip-muted",
  confirm_appointment: "chip-cool",
  manual: "chip-muted",
};

export function FeedCardRow({ card }: { card: FeedCard }) {
  const slaBreached = card.slaMsRemaining != null && card.slaMsRemaining < 0;
  const slaSoon = card.slaMsRemaining != null && card.slaMsRemaining >= 0 && card.slaMsRemaining < 5 * 60_000;

  return (
    <div className="card p-4 flex items-start gap-4">
      <div className="flex-none">
        <span className={kindChip[card.kind]}>{kindLabel[card.kind]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium truncate">{card.title}</h3>
          {card.expectedGross > 0 && (
            <span className="text-xs text-ink-muted">· est ${card.expectedGross.toLocaleString()} gross</span>
          )}
          {slaBreached && <span className="chip-hot">SLA breached</span>}
          {!slaBreached && slaSoon && <span className="chip-warm">SLA soon</span>}
        </div>
        {card.body && <p className="text-sm text-ink-muted mt-1 line-clamp-2">{card.body}</p>}
        <div className="text-xs text-ink-muted mt-2">
          {formatDistanceToNowStrict(card.createdAt, { addSuffix: true })}
          {card.slaMsRemaining != null && !slaBreached && (
            <> · SLA in {Math.max(0, Math.round(card.slaMsRemaining / 60_000))}m</>
          )}
        </div>
      </div>
      <div className="flex-none flex gap-2">
        {card.leadId && (
          <Link href={`/rep/lead/${card.leadId}`} className="btn-primary">
            Open
          </Link>
        )}
        {!card.leadId && card.opportunityId && (
          <Link href={`/service`} className="btn-primary">
            Open
          </Link>
        )}
      </div>
    </div>
  );
}
