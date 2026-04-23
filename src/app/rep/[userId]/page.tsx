import { prisma } from "@/lib/prisma";
import { getRepFeed } from "@/domain/feed";
import { FeedCardRow } from "@/components/FeedCard";

export const dynamic = "force-dynamic";

export default async function RepFeedPage({ params }: { params: { userId: string } }) {
  const rep = await prisma.user.findUnique({ where: { id: params.userId }, include: { rooftop: true } });
  if (!rep) return <div className="p-4">Rep not found.</div>;

  const feed = await getRepFeed(rep.rooftopId, rep.id, 15);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const appointmentsSetToday = await prisma.appointment.count({
    where: { rooftopId: rep.rooftopId, repId: rep.id, createdAt: { gte: today } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">{rep.name}</h1>
          <div className="text-xs text-ink-muted">{rep.rooftop.name}</div>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Open cards" value={feed.length} />
          <Stat label="Appts set today" value={appointmentsSetToday} />
          <Stat label="$ pipe" value={`$${feed.reduce((s, c) => s + c.expectedGross, 0).toLocaleString()}`} />
        </div>
      </div>

      <div className="space-y-3">
        {feed.length === 0 ? (
          <div className="card p-6 text-center text-ink-muted text-sm">
            Your feed is empty. Nice work.
          </div>
        ) : (
          feed.map((card) => <FeedCardRow key={card.taskId} card={card} />)
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
