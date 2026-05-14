import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { parseISO } from "date-fns";
import { smsAdapter } from "@/integrations/sms";
import { env } from "@/lib/env";

// Tools the AI sales rep can call DURING an outbound call. Each one maps to a
// real write against the outreach data island — the model can't make outcomes
// up. Mirrors the shape of src/ai/tools.ts but for the GTM engine.

export type OutreachToolContext = {
  outreachCallId: string;
  prospectId: string;
  campaignId?: string;
  targetId?: string;
};

export type ToolResult =
  | { ok: true; content: unknown }
  | { ok: false; error: string };

export function getOutreachToolSchemas(): Anthropic.Tool[] {
  return [
    {
      name: "log_qualification",
      description:
        "Record what you learned about the prospect's fit while qualifying them. Call this whenever you learn something useful — even mid-call. It does not end the call.",
      input_schema: {
        type: "object",
        properties: {
          decision_maker_reached: { type: "boolean", description: "True if you're talking to the owner/manager who can buy." },
          misses_calls: { type: "boolean", description: "True if they admit they miss or can't always answer calls." },
          calls_per_day: { type: "number", description: "Rough inbound call volume per day, if mentioned." },
          current_solution: { type: "string", description: "How they handle calls today (front desk, voicemail, answering service, nothing)." },
          pain_points: { type: "string", description: "Anything they said about what frustrates them about phone handling." },
          notes: { type: "string", description: "Any other context worth saving." },
        },
        required: [],
      },
    },
    {
      name: "book_demo",
      description:
        "Book a product demo. Only call this AFTER the prospect has verbally agreed to a specific date and time and you've read it back to them.",
      input_schema: {
        type: "object",
        properties: {
          demo_at_iso: { type: "string", description: "Exact ISO 8601 date-time the prospect agreed to." },
          contact_name: { type: "string", description: "Name of the person who'll attend the demo." },
          contact_email: { type: "string", description: "Their email, if they'll share it. Optional." },
          notes: { type: "string", description: "Anything to brief the demo team on." },
        },
        required: ["demo_at_iso", "contact_name"],
      },
    },
    {
      name: "request_callback",
      description:
        "The prospect is open but can't talk or commit now. Schedule a callback. The campaign will re-attempt the call after this time.",
      input_schema: {
        type: "object",
        properties: {
          callback_at_iso: { type: "string", description: "ISO 8601 time they asked to be called back. If vague, pick a reasonable next-business-day time." },
          note: { type: "string", description: "Why they want a callback / what to reference next time." },
        },
        required: ["note"],
      },
    },
    {
      name: "mark_not_interested",
      description: "The prospect is not interested or it's a bad fit. Call this, then end the call warmly.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Brief reason — 'happy with current setup', 'too small', 'no budget', etc." },
          bad_fit: { type: "boolean", description: "True if they're genuinely not a fit (e.g. not a real business, wrong industry)." },
        },
        required: ["reason"],
      },
    },
    {
      name: "add_to_dnc",
      description:
        "The prospect asked to not be called again, asked to be removed, or said they're on a do-not-call list. Call this IMMEDIATELY, stop pitching, and end the call. This suppresses the number permanently.",
      input_schema: {
        type: "object",
        properties: {
          reason: { type: "string", enum: ["opted_out", "complaint", "wrong_number"], description: "Why the number is being suppressed." },
          note: { type: "string" },
        },
        required: [],
      },
    },
    {
      name: "end_call",
      description: "End the call. Only call this AFTER you've said goodbye out loud in the same turn.",
      input_schema: {
        type: "object",
        properties: {
          outcome: {
            type: "string",
            enum: ["demo_booked", "callback_requested", "not_interested", "no_answer", "voicemail", "wrong_number", "bad_fit", "gatekeeper_blocked", "do_not_call"],
          },
        },
        required: ["outcome"],
      },
    },
  ];
}

// --- Execution ----------------------------------------------------------

export async function executeOutreachTool(
  ctx: OutreachToolContext,
  name: string,
  input: any,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "log_qualification":   return await logQualification(ctx, input);
      case "book_demo":           return await bookDemo(ctx, input);
      case "request_callback":    return await requestCallback(ctx, input);
      case "mark_not_interested": return await markNotInterested(ctx, input);
      case "add_to_dnc":          return await addToDnc(ctx, input);
      case "end_call":            return await endCall(ctx, input);
      default:                    return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function logQualification(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  const parts: string[] = [];
  if (input.decision_maker_reached != null) parts.push(`Decision maker reached: ${input.decision_maker_reached ? "yes" : "no"}`);
  if (input.misses_calls != null) parts.push(`Misses calls: ${input.misses_calls ? "yes" : "no"}`);
  if (typeof input.calls_per_day === "number") parts.push(`~${input.calls_per_day} calls/day`);
  if (input.current_solution) parts.push(`Today: ${input.current_solution}`);
  if (input.pain_points) parts.push(`Pain: ${input.pain_points}`);
  if (input.notes) parts.push(input.notes);
  const note = parts.join(" · ");
  if (note) {
    const prospect = await prisma.prospect.findUnique({ where: { id: ctx.prospectId } });
    const merged = prospect?.qualificationNote ? `${prospect.qualificationNote}\n[call] ${note}` : `[call] ${note}`;
    await prisma.prospect.update({ where: { id: ctx.prospectId }, data: { qualificationNote: merged } });
  }
  return { ok: true, content: { logged: true } };
}

async function bookDemo(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  const demoAt = parseISO(input.demo_at_iso);
  if (Number.isNaN(demoAt.getTime())) return { ok: false, error: "invalid demo_at_iso" };

  await prisma.outreachCall.update({
    where: { id: ctx.outreachCallId },
    data: {
      disposition: "demo_booked",
      demoAt,
      demoContactName: input.contact_name ?? null,
      demoContactEmail: input.contact_email ?? null,
    },
  });
  const prospect = await prisma.prospect.update({
    where: { id: ctx.prospectId },
    data: {
      status: "converted",
      disposition: "demo_booked",
      demoAt,
      demoContactName: input.contact_name ?? null,
      demoContactEmail: input.contact_email ?? null,
    },
  });
  if (ctx.targetId) {
    await prisma.outreachTarget.update({
      where: { id: ctx.targetId },
      data: { status: "completed", outcomeNote: `Demo booked for ${demoAt.toISOString()}` },
    });
  }

  // Confirmation text to the prospect (mock-safe — logs to console without Twilio).
  if (prospect.phone) {
    await smsAdapter()
      .send({
        to: prospect.phone,
        body: `${env.OUTREACH_COMPANY_NAME}: thanks ${input.contact_name ?? ""}! Your demo is set for ${demoAt.toLocaleString()}. Reply STOP to opt out.`,
      })
      .catch(() => undefined);
  }

  return {
    ok: true,
    content: {
      demo_confirmed_at_iso: demoAt.toISOString(),
      contact_name: input.contact_name,
      sms_confirmation_sent: Boolean(prospect.phone),
    },
  };
}

async function requestCallback(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  const callbackAt = input.callback_at_iso ? parseISO(input.callback_at_iso) : null;
  const valid = callbackAt && !Number.isNaN(callbackAt.getTime()) ? callbackAt : null;

  await prisma.outreachCall.update({
    where: { id: ctx.outreachCallId },
    data: { disposition: "callback_requested" },
  });
  await prisma.prospect.update({
    where: { id: ctx.prospectId },
    data: { disposition: "callback_requested" },
  });
  if (ctx.targetId) {
    // Put the target back in the queue so the dispatcher re-attempts it after
    // the callback time. Falls back to "soon" if no time was given.
    await prisma.outreachTarget.update({
      where: { id: ctx.targetId },
      data: {
        status: "pending",
        nextAttemptAt: valid ?? new Date(Date.now() + 60 * 60 * 1000),
        outcomeNote: `Callback requested: ${input.note}`,
      },
    });
  }
  return { ok: true, content: { callback_scheduled_for: valid?.toISOString() ?? "next attempt window" } };
}

async function markNotInterested(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  await prisma.outreachCall.update({
    where: { id: ctx.outreachCallId },
    data: { disposition: input.bad_fit ? "bad_fit" : "not_interested" },
  });
  await prisma.prospect.update({
    where: { id: ctx.prospectId },
    data: { status: "lost", disposition: input.bad_fit ? "bad_fit" : "not_interested" },
  });
  if (ctx.targetId) {
    await prisma.outreachTarget.update({
      where: { id: ctx.targetId },
      data: { status: "completed", outcomeNote: `Not interested: ${input.reason}` },
    });
  }
  return { ok: true, content: { recorded: true } };
}

async function addToDnc(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  const prospect = await prisma.prospect.findUnique({ where: { id: ctx.prospectId } });
  const reason = ["opted_out", "complaint", "wrong_number"].includes(input.reason) ? input.reason : "opted_out";

  if (prospect?.phone) {
    await prisma.suppressionEntry.upsert({
      where: { phone: prospect.phone },
      create: { phone: prospect.phone, reason, note: input.note ?? null },
      update: { reason, note: input.note ?? null },
    });
  }
  await prisma.outreachCall.update({
    where: { id: ctx.outreachCallId },
    data: { disposition: reason === "wrong_number" ? "wrong_number" : "do_not_call" },
  });
  await prisma.prospect.update({
    where: { id: ctx.prospectId },
    data: {
      status: "do_not_call",
      doNotCall: true,
      disposition: reason === "wrong_number" ? "wrong_number" : "do_not_call",
    },
  });
  if (ctx.targetId) {
    await prisma.outreachTarget.update({
      where: { id: ctx.targetId },
      data: { status: "opted_out", outcomeNote: `Suppressed: ${reason}` },
    });
  }
  return { ok: true, content: { suppressed: true } };
}

async function endCall(ctx: OutreachToolContext, input: any): Promise<ToolResult> {
  const call = await prisma.outreachCall.findUnique({ where: { id: ctx.outreachCallId } });
  if (call && !call.disposition && input.outcome) {
    await prisma.outreachCall.update({
      where: { id: ctx.outreachCallId },
      data: { disposition: input.outcome },
    });
  }
  return { ok: true, content: { ended: true } };
}
