import { NextRequest, NextResponse } from "next/server";
import { sendDailyDigest } from "@/outreach/digest";

// Once-a-day cron hook: point cron-job.org at
//   https://insani.ai/api/cron/outreach-digest?key=<CRON_SECRET>
// with a daily schedule at whatever local time makes sense (e.g. 8am ADT ~
// 12:00 UTC in summer, 13:00 UTC in winter). Same CRON_SECRET the outreach
// dispatcher uses — one secret to manage.

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get("key");
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (key !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const result = await sendDailyDigest();
    console.log(`[cron-outreach-digest] ${JSON.stringify(result)}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron-outreach-digest] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
