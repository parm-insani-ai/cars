import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rescoreAllProspects } from "@/outreach/qualify";

// Re-score every prospect against the current scoring rules, without sourcing
// anything new (no Google Places calls). Admin-gated.

export async function POST() {
  const user = await requireUser();
  if (user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await rescoreAllProspects();
  return NextResponse.json(result);
}
