import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { format, isFuture } from "date-fns";

export const dynamic = "force-dynamic";

export default async function BookedDemosPage() {
  const demos = await prisma.outreachCall.findMany({
    where: { disposition: "demo_booked", demoAt: { not: null } },
    include: { prospect: true, campaign: true },
    orderBy: { demoAt: "asc" },
    take: 200,
  });

  const upcoming = demos.filter(d => d.demoAt && isFuture(d.demoAt));
  const past = demos.filter(d => !d.demoAt || !isFuture(d.demoAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Booked demos</h1>
        <p className="page-sub">
          Every demo Ava has booked. Upcoming demos appear first — confirm them on your calendar and reach out before the slot.
        </p>
      </div>

      <Section title={`Upcoming (${upcoming.length})`} demos={upcoming} emptyText="No upcoming demos yet." />
      <Section title={`Past (${past.length})`} demos={past} emptyText="No past demos." />
    </div>
  );
}

function Section({
  title,
  demos,
  emptyText,
}: {
  title: string;
  demos: Awaited<ReturnType<typeof prisma.outreachCall.findMany>>;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="section-title">{title}</h2>
      <div className="card overflow-hidden">
        {demos.length === 0 ? (
          <div className="empty">
            <div className="empty-title">{emptyText}</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>Demo time (local)</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Campaign</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {demos.map((d: any) => (
                <tr key={d.id}>
                  <td className="font-medium">
                    <Link href={`/outreach/prospects/${d.prospectId}`} className="text-lane hover:underline">
                      {d.prospect.businessName}
                    </Link>
                  </td>
                  <td className="text-xs">{d.demoAt ? format(d.demoAt, "EEE, MMM d · h:mm a") : "—"}</td>
                  <td className="text-xs">
                    {d.demoContactName ?? "—"}
                    {d.demoContactEmail && <div className="text-ink-muted">{d.demoContactEmail}</div>}
                  </td>
                  <td className="text-xs">{d.prospect.phone ?? "—"}</td>
                  <td className="text-xs text-ink-muted">{d.campaign?.name ?? "—"}</td>
                  <td className="text-xs">
                    <Link href={`/outreach/calls/${d.id}`} className="text-lane hover:underline">View call</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
