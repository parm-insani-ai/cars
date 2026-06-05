import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lightweight liveness probe for uptime monitors (UptimeRobot, BetterStack,
// Vercel's own health checks). Returns ok when the app can serve requests and
// the database is reachable.

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      now: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "db_unreachable",
        latencyMs: Date.now() - startedAt,
      },
      { status: 503 },
    );
  }
}
