import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  // MVP: pick the first rooftop + first rep, so the demo app routes to a working feed.
  const rooftop = await prisma.rooftop.findFirst().catch(() => null);
  const rep = rooftop
    ? await prisma.user.findFirst({ where: { rooftopId: rooftop.id, role: "rep" } })
    : null;

  return (
    <div className="max-w-2xl mx-auto py-12 space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-semibold mb-2">Revline</h1>
        <p className="text-ink-muted text-sm mb-4">
          AI appointment & opportunity engine. Pick a starting point.
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <Link className="text-lane hover:underline" href={rep ? `/rep/${rep.id}` : "/rep"}>
              → Rep feed {rep ? `(${rep.name})` : ""}
            </Link>
          </li>
          <li>
            <Link className="text-lane hover:underline" href="/manager">
              → Manager dashboard
            </Link>
          </li>
          <li>
            <Link className="text-lane hover:underline" href="/service">
              → Service-drive opportunities
            </Link>
          </li>
          <li>
            <Link className="text-lane hover:underline" href="/settings">
              → Setup / integrations
            </Link>
          </li>
        </ul>
      </div>
      {!rooftop && (
        <div className="card p-4 text-sm text-ink-muted">
          No rooftop found. Run <code className="font-mono">npm run db:seed</code> to create a demo dealership.
        </div>
      )}
    </div>
  );
}
