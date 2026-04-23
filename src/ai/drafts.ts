import { prisma } from "@/lib/prisma";
import { runDraft } from "./run";
import type { Lead, Customer, Vehicle, Rooftop, User } from "@prisma/client";

// --- First response to a freshly-arrived lead ------------------------------
export async function draftFirstResponse(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { customer: true, interestVehicle: true, rooftop: true, assignedRep: true },
  });
  const rep = lead.assignedRep;

  const facts = buildLeadFacts(lead, lead.customer, lead.interestVehicle, rep);

  const userMessage =
    `A brand new ${lead.source} lead just arrived. Write an SMS for the assigned rep to send. ` +
    `It must be under 320 characters, reference the specific vehicle by year/make/model ONLY if it's in stock ` +
    `(check with get_inventory_matches first if unsure), and propose two concrete appointment times ` +
    `(use get_rep_availability). Ask ONE clear question. End with the compliance line.\n\n` +
    `=== Facts ===\n${facts}\n\n` +
    `Return ONLY the SMS text. No prose before or after.`;

  return runDraft({ rooftop: lead.rooftop, task: "draft_first_response", userMessage });
}

// --- Nudge / follow-up when the lead hasn't replied -----------------------
export async function draftFollowup(leadId: string, attemptNumber: number) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      customer: true,
      interestVehicle: true,
      rooftop: true,
      assignedRep: true,
      messages: { orderBy: { createdAt: "asc" }, take: 10 },
    },
  });

  const threadText = lead.messages
    .map((m) => `[${m.direction}/${m.channel}] ${m.body}`)
    .join("\n") || "(no prior messages)";

  const userMessage =
    `Write the next follow-up SMS. This is attempt #${attemptNumber}. Do not repeat anything you've already said. ` +
    `Change the angle: offer a different time, a trade-value check, or a vehicle alternative from inventory.\n\n` +
    `=== Facts ===\n${buildLeadFacts(lead, lead.customer, lead.interestVehicle, lead.assignedRep)}\n\n` +
    `=== Thread so far ===\n${threadText}\n\n` +
    `Return ONLY the SMS text.`;

  return runDraft({ rooftop: lead.rooftop, task: "draft_followup", userMessage });
}

// --- Missed sales call → callback SMS -------------------------------------
export async function draftMissedCallSms(callId: string) {
  const call = await prisma.callEvent.findUniqueOrThrow({
    where: { id: callId },
    include: { rooftop: true, customer: true, rep: true, transcript: true },
  });

  const parts: string[] = [
    `Missed inbound ${call.department ?? "sales"} call at ${call.startedAt.toISOString()}.`,
    `From: ${call.fromNumber}.`,
  ];
  if (call.customer) {
    parts.push(`Customer: ${call.customer.firstName ?? ""} ${call.customer.lastName ?? ""} (id=${call.customer.id}).`);
  } else {
    parts.push(`Customer: unknown — do not use a name.`);
  }
  if (call.transcript?.summary) parts.push(`Voicemail summary: ${call.transcript.summary}`);
  if (call.rep) parts.push(`Intended rep: ${call.rep.name} (id=${call.rep.id}).`);

  const userMessage =
    `Write a short callback SMS from the rep. ` +
    `Acknowledge the missed call, apologize briefly, and offer to call back now OR at a specific time (use get_rep_availability if a rep is known). ` +
    `If we have the customer id, use get_customer_history to personalize. Keep under 300 characters.\n\n` +
    `=== Facts ===\n${parts.join("\n")}\n\n` +
    `Return ONLY the SMS text.`;

  return runDraft({ rooftop: call.rooftop, task: "draft_missed_call_sms", userMessage });
}

// --- Service-drive customer → sales pitch --------------------------------
export async function draftServicePitch(opportunityId: string) {
  const opp = await prisma.opportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      rooftop: true,
      customer: { include: { vehiclesOwned: { take: 1, orderBy: { purchaseDate: "desc" } } } },
    },
  });
  const owned = opp.customer.vehiclesOwned[0];

  const userMessage =
    `Write a 2-sentence talk track for a sales rep to walk into the service waiting area and pitch an upgrade. ` +
    `${opp.customer.firstName ?? "The customer"} currently drives a ${owned?.year ?? "?"} ${owned?.make ?? ""} ${owned?.model ?? ""} ` +
    `(est. payoff $${owned?.estimatedPayoff ?? "?"}, est. value $${owned?.estimatedValue ?? "?"}). ` +
    `Use get_inventory_matches to find 1 real in-stock upgrade at a similar monthly payment. ` +
    `Then write: (1) the spoken opener the rep says in person, (2) a 2-line SMS follow-up to send after. ` +
    `Keep both casual and specific. Reference a real vehicle only if the tool returned one.\n\n` +
    `Rationale for this opportunity: ${opp.rationale ?? "positive equity + upgrade-ready"}.\n` +
    `Return a JSON object: {"talk_track": "...", "sms": "..."}. Nothing else.`;

  return runDraft({ rooftop: opp.rooftop, task: "draft_service_pitch", userMessage });
}

function buildLeadFacts(
  lead: Lead,
  customer: Customer,
  vehicle: Vehicle | null,
  rep: User | null,
): string {
  const parts: string[] = [];
  parts.push(`Customer id: ${customer.id}`);
  parts.push(`Customer first name: ${customer.firstName ?? "(unknown)"}`);
  parts.push(`Source: ${lead.source}`);
  parts.push(`Lead created at: ${lead.createdAt.toISOString()}`);
  if (vehicle) {
    parts.push(
      `Vehicle of interest (verify in stock before naming): ${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim ?? ""} stock#${vehicle.stockNumber} price $${vehicle.price}`,
    );
  } else {
    parts.push(`Vehicle of interest: none specified. Ask what they're shopping for.`);
  }
  if (rep) parts.push(`Assigned rep id: ${rep.id}. Rep name: ${rep.name}`);
  parts.push(`SMS consent on file: ${customer.smsConsent ? "yes" : "NO — do NOT draft an SMS, draft an email instead"}`);
  return parts.join("\n");
}
