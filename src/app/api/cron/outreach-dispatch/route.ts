import { NextRequest, NextResponse } from "next/server";
import { runOutreachDispatch } from "@/outreach/dispatch";

// Plain HTTP alternative to the Inngest-scheduled outreachDispatcher.
// Point cron-job.org (or any minutely webhook trigger) at this URL to keep
// campaigns dialing without Inngest Cloud.
//
// Protected by CRON_SECRET so a random visitor can't kick off calls.
// The secret is set once in Vercel env + as a query param on the cron URL:
//
//   https://insani.ai/api/cron/outreach-dispatch?key=<CRON_SECRET>

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = req.nextUrl.searchParams.get("key");
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (key !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runOutreachDispatch();
    console.log(`[cron-outreach-dispatch] ${JSON.stringify(result)}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron-outreach-dispatch] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
