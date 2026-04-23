import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestLead } from "@/domain/leads";
import { parseAdfXml } from "@/integrations/adf";
import { inngest } from "@/inngest/client";

// Accepts two shapes:
// 1. ADF XML (email gateway forwards this)
// 2. JSON (website partner webhooks)
const JsonSchema = z.object({
  rooftopId: z.string(),
  source: z.enum([
    "website",
    "autotrader",
    "cargurus",
    "cars_com",
    "facebook",
    "referral",
    "walk_in",
    "phone_in",
    "service",
    "other",
  ]),
  customer: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  vehicle: z
    .object({
      stockNumber: z.string().optional(),
      year: z.number().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  let result: { rooftopId: string; source: any; customer: any; vehicle?: any; raw?: unknown };

  if (contentType.includes("xml")) {
    const xml = await req.text();
    const rooftopId = req.headers.get("x-revline-rooftop-id");
    if (!rooftopId) return NextResponse.json({ error: "missing rooftop id" }, { status: 400 });
    const parsed = parseAdfXml(xml);
    result = {
      rooftopId,
      source: "website",
      customer: {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        phone: parsed.phone,
        email: parsed.email,
      },
      vehicle: parsed.vehicle,
      raw: xml,
    };
  } else {
    const json = await req.json();
    const parsed = JsonSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    result = {
      rooftopId: parsed.data.rooftopId,
      source: parsed.data.source,
      customer: parsed.data.customer,
      vehicle: parsed.data.vehicle,
      raw: json,
    };
  }

  const { leadId } = await ingestLead({
    rooftopId: result.rooftopId,
    source: result.source,
    customer: result.customer,
    vehicleOfInterest: result.vehicle,
    rawPayload: result.raw,
  });

  // Kick off the AI cadence workflow.
  await inngest.send({ name: "lead/created", data: { leadId } });

  return NextResponse.json({ ok: true, leadId });
}
