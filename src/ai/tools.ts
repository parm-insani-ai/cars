import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { findAvailableSlots, createAppointment, lookupOrCreateCustomer } from "@/domain/booking";
import { addDays, parseISO } from "date-fns";

// Tools the voice agent can call DURING a call. Each tool maps to a real
// database operation; the model cannot make anything up.

export type ToolContext = {
  businessId: string;
  callSessionId: string;
  // Caller phone parsed by Vapi from SIP — used as the default identity.
  callerPhone?: string;
};

export type ToolResult =
  | { ok: true; content: unknown }
  | { ok: false; error: string };

export function getToolSchemas(opts: {
  canBook: boolean;
  canReschedule: boolean;
  canCancel: boolean;
  canTransfer: boolean;
  vertical: "dealership" | "service_shop" | "wellness";
}): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    {
      name: "list_services",
      description: "List the services this business offers (name, duration, price). Call when the caller asks 'what do you do' or 'what services do you offer'.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "check_availability",
      description: "Find the next available appointment slots for a service. Returns up to 5 specific times (ISO 8601). Always call this BEFORE telling the caller a specific time is open.",
      input_schema: {
        type: "object",
        properties: {
          service_id: { type: "string", description: "The id of the service the caller wants." },
          provider_id: { type: "string", description: "Optional. If the caller asked for a specific person/resource by id." },
          earliest_iso: { type: "string", description: "Optional. Earliest acceptable time as ISO 8601. Defaults to now." },
          days_to_search: { type: "number", description: "How many days forward to search. Default 7." },
        },
        required: ["service_id"],
      },
    },
    {
      name: "lookup_customer",
      description: "Find an existing customer by phone or email. Call this once you have either piece of info to greet returning customers by name.",
      input_schema: {
        type: "object",
        properties: {
          phone: { type: "string" },
          email: { type: "string" },
        },
        required: [],
      },
    },
  ];

  if (opts.canBook) {
    tools.push({
      name: "book_appointment",
      description: "Book an appointment. Only call this after the caller has agreed to a specific date and time and you have their full name and phone number.",
      input_schema: {
        type: "object",
        properties: {
          service_id: { type: "string" },
          provider_id: { type: "string", description: "Optional. If unspecified, 'any available' is used." },
          scheduled_at_iso: { type: "string", description: "Exact ISO 8601 time the caller agreed to. Must match a slot returned by check_availability." },
          customer_first_name: { type: "string" },
          customer_last_name: { type: "string" },
          customer_phone: { type: "string", description: "E.164. Defaults to the caller's number if not provided." },
          customer_email: { type: "string" },
          notes: { type: "string", description: "Any context the caller shared (problem description, special requests)." },
        },
        required: ["service_id", "scheduled_at_iso", "customer_first_name", "customer_phone"],
      },
    });
  }

  if (opts.canReschedule || opts.canCancel) {
    tools.push({
      name: "find_upcoming_appointments",
      description: "Find a caller's upcoming appointments. Use this when a caller wants to reschedule or cancel.",
      input_schema: {
        type: "object",
        properties: { phone: { type: "string" }, email: { type: "string" } },
        required: [],
      },
    });
  }

  if (opts.canReschedule) {
    tools.push({
      name: "reschedule_appointment",
      description: "Move an existing appointment to a new time. Caller must have agreed to the new time (which must come from check_availability).",
      input_schema: {
        type: "object",
        properties: {
          appointment_id: { type: "string" },
          new_scheduled_at_iso: { type: "string" },
        },
        required: ["appointment_id", "new_scheduled_at_iso"],
      },
    });
  }

  if (opts.canCancel) {
    tools.push({
      name: "cancel_appointment",
      description: "Cancel an upcoming appointment.",
      input_schema: {
        type: "object",
        properties: { appointment_id: { type: "string" }, reason: { type: "string" } },
        required: ["appointment_id"],
      },
    });
  }

  tools.push({
    name: "take_message",
    description: "Take a structured message when you can't help. Use this for anything outside scope (price quotes, complaints, vendor inquiries, etc.).",
    input_schema: {
      type: "object",
      properties: {
        caller_name: { type: "string" },
        caller_phone: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        urgency: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["subject", "body"],
    },
  });

  if (opts.canTransfer) {
    tools.push({
      name: "transfer_to_human",
      description: "Transfer the live call to a human at the configured number. Only call when the caller has explicitly asked, or the request is clearly out of scope and they decline a callback.",
      input_schema: {
        type: "object",
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    });
  }

  tools.push({
    name: "end_call",
    description: "End the call. Only call this AFTER you have spoken a clear goodbye in the same turn.",
    input_schema: {
      type: "object",
      properties: { outcome: { type: "string", enum: ["booked", "rescheduled", "canceled", "message_taken", "no_action"] } },
      required: ["outcome"],
    },
  });

  if (opts.vertical === "dealership") {
    tools.push({
      name: "lookup_vehicle",
      description: "Search current in-stock inventory by make/model/body type/price band.",
      input_schema: {
        type: "object",
        properties: {
          make: { type: "string" },
          model: { type: "string" },
          body_type: { type: "string", enum: ["sedan", "suv", "truck", "coupe", "hatchback", "minivan", "convertible", "wagon"] },
          max_price: { type: "number" },
          min_price: { type: "number" },
          new_only: { type: "boolean" },
        },
        required: [],
      },
    });
  }

  return tools;
}

// --- Execution ----------------------------------------------------------------

export async function executeTool(
  ctx: ToolContext,
  name: string,
  input: any,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_services":              return await listServices(ctx);
      case "check_availability":         return await checkAvailability(ctx, input);
      case "lookup_customer":            return await lookupCustomer(ctx, input);
      case "book_appointment":           return await bookAppointment(ctx, input);
      case "find_upcoming_appointments": return await findUpcoming(ctx, input);
      case "reschedule_appointment":     return await rescheduleAppointment(ctx, input);
      case "cancel_appointment":         return await cancelAppointment(ctx, input);
      case "take_message":               return await takeMessage(ctx, input);
      case "transfer_to_human":          return await transferToHuman(ctx, input);
      case "end_call":                   return await endCall(ctx, input);
      case "lookup_vehicle":             return await lookupVehicle(ctx, input);
      default: return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

async function listServices(ctx: ToolContext): Promise<ToolResult> {
  const services = await prisma.service.findMany({
    where: { businessId: ctx.businessId, active: true },
    orderBy: { name: "asc" },
  });
  return {
    ok: true,
    content: {
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        duration_minutes: s.durationMin,
        price_usd: s.priceUsd,
        description: s.description,
      })),
    },
  };
}

async function checkAvailability(ctx: ToolContext, input: any): Promise<ToolResult> {
  const earliest = input.earliest_iso ? parseISO(input.earliest_iso) : new Date();
  const days = Math.min(14, Math.max(1, input.days_to_search ?? 7));
  const slots = await findAvailableSlots({
    businessId: ctx.businessId,
    serviceId: input.service_id,
    providerId: input.provider_id ?? undefined,
    earliest,
    latest: addDays(earliest, days),
    limit: 5,
  });
  return {
    ok: true,
    content: {
      slots: slots.map(s => ({
        scheduled_at_iso: s.scheduledAt.toISOString(),
        provider_id: s.providerId,
        provider_name: s.providerName,
      })),
    },
  };
}

async function lookupCustomer(ctx: ToolContext, input: any): Promise<ToolResult> {
  const phone = input.phone ?? ctx.callerPhone;
  const email = input.email;
  if (!phone && !email) return { ok: false, error: "Need at least phone or email" };
  const customer = await prisma.customer.findFirst({
    where: {
      businessId: ctx.businessId,
      OR: [phone ? { phone } : null, email ? { email } : null].filter(Boolean) as any,
    },
    include: { appointments: { orderBy: { scheduledAt: "desc" }, take: 3, include: { service: true } } },
  });
  if (!customer) return { ok: true, content: { found: false } };
  return {
    ok: true,
    content: {
      found: true,
      customer_id: customer.id,
      first_name: customer.firstName,
      last_name: customer.lastName,
      sms_consent: customer.smsConsent,
      recent_appointments: customer.appointments.map(a => ({
        service: a.service.name,
        scheduled_at_iso: a.scheduledAt.toISOString(),
        status: a.status,
      })),
    },
  };
}

async function bookAppointment(ctx: ToolContext, input: any): Promise<ToolResult> {
  const customer = await lookupOrCreateCustomer({
    businessId: ctx.businessId,
    phone: input.customer_phone || ctx.callerPhone || "",
    email: input.customer_email,
    firstName: input.customer_first_name,
    lastName: input.customer_last_name,
  });
  const result = await createAppointment({
    businessId: ctx.businessId,
    customerId: customer.id,
    serviceId: input.service_id,
    providerId: input.provider_id ?? null,
    scheduledAt: parseISO(input.scheduled_at_iso),
    notes: input.notes,
    callSessionId: ctx.callSessionId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  await prisma.callSession.update({
    where: { id: ctx.callSessionId },
    data: { bookedApptId: result.appointment.id, outcome: "booked" },
  });
  return {
    ok: true,
    content: {
      appointment_id: result.appointment.id,
      confirmed_at_iso: result.appointment.scheduledAt.toISOString(),
      service_name: result.serviceName,
      provider_name: result.providerName,
    },
  };
}

async function findUpcoming(ctx: ToolContext, input: any): Promise<ToolResult> {
  const phone = input.phone ?? ctx.callerPhone;
  const email = input.email;
  if (!phone && !email) return { ok: false, error: "Need phone or email" };
  const customer = await prisma.customer.findFirst({
    where: {
      businessId: ctx.businessId,
      OR: [phone ? { phone } : null, email ? { email } : null].filter(Boolean) as any,
    },
  });
  if (!customer) return { ok: true, content: { appointments: [] } };
  const appts = await prisma.appointment.findMany({
    where: {
      businessId: ctx.businessId,
      customerId: customer.id,
      status: { in: ["pending", "confirmed", "reminded"] },
      scheduledAt: { gte: new Date() },
    },
    include: { service: true, provider: true },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });
  return {
    ok: true,
    content: {
      appointments: appts.map(a => ({
        appointment_id: a.id,
        service: a.service.name,
        provider: a.provider?.name ?? "any",
        scheduled_at_iso: a.scheduledAt.toISOString(),
      })),
    },
  };
}

async function rescheduleAppointment(ctx: ToolContext, input: any): Promise<ToolResult> {
  const appt = await prisma.appointment.findFirst({
    where: { id: input.appointment_id, businessId: ctx.businessId },
  });
  if (!appt) return { ok: false, error: "appointment_not_found" };
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { scheduledAt: parseISO(input.new_scheduled_at_iso), status: "confirmed" },
  });
  await prisma.callSession.update({
    where: { id: ctx.callSessionId },
    data: { outcome: "rescheduled" },
  });
  return { ok: true, content: { rescheduled_to: input.new_scheduled_at_iso } };
}

async function cancelAppointment(ctx: ToolContext, input: any): Promise<ToolResult> {
  const appt = await prisma.appointment.findFirst({
    where: { id: input.appointment_id, businessId: ctx.businessId },
  });
  if (!appt) return { ok: false, error: "appointment_not_found" };
  await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "canceled", notes: appt.notes ? `${appt.notes}\nCanceled: ${input.reason ?? "(no reason)"}` : `Canceled: ${input.reason ?? "(no reason)"}` },
  });
  await prisma.callSession.update({
    where: { id: ctx.callSessionId },
    data: { outcome: "canceled" },
  });
  return { ok: true, content: { canceled: true } };
}

async function takeMessage(ctx: ToolContext, input: any): Promise<ToolResult> {
  // Stored as a CallTurn with role=system and the call outcome set later.
  await prisma.callTurn.create({
    data: {
      sessionId: ctx.callSessionId,
      role: "system",
      text: `MESSAGE: ${input.subject}\n${input.body}\nFrom: ${input.caller_name ?? "(no name)"} ${input.caller_phone ?? ctx.callerPhone ?? ""}\nUrgency: ${input.urgency ?? "medium"}`,
    },
  });
  await prisma.callSession.update({
    where: { id: ctx.callSessionId },
    data: { outcome: "message_taken" },
  });
  return { ok: true, content: { message_logged: true } };
}

async function transferToHuman(ctx: ToolContext, input: any): Promise<ToolResult> {
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    include: { agentConfig: true },
  });
  const number = business?.agentConfig?.transferTo;
  if (!number) return { ok: false, error: "no_transfer_number_configured" };
  await prisma.callSession.update({
    where: { id: ctx.callSessionId },
    data: { outcome: "transferred" },
  });
  // The actual transfer is performed by Vapi when our LLM emits this tool —
  // see /api/voice/llm/route.ts where we map tool calls to Vapi actions.
  return { ok: true, content: { transfer_number: number, reason: input.reason } };
}

async function endCall(ctx: ToolContext, input: any): Promise<ToolResult> {
  const session = await prisma.callSession.findUnique({ where: { id: ctx.callSessionId } });
  if (session && session.outcome === "in_progress") {
    await prisma.callSession.update({
      where: { id: ctx.callSessionId },
      data: { outcome: input.outcome ?? "no_action" },
    });
  }
  return { ok: true, content: { ended: true } };
}

async function lookupVehicle(ctx: ToolContext, input: any): Promise<ToolResult> {
  const where: any = { businessId: ctx.businessId, status: "in_stock" };
  if (input.make) where.make = { equals: input.make, mode: "insensitive" };
  if (input.model) where.model = { contains: input.model, mode: "insensitive" };
  if (input.body_type) where.bodyType = input.body_type;
  if (input.new_only) where.isNew = true;
  if (input.min_price || input.max_price) where.price = { gte: input.min_price ?? 0, lte: input.max_price ?? 1_000_000 };
  const matches = await prisma.vehicle.findMany({ where, take: 5, orderBy: { price: "asc" } });
  if (matches.length === 0) return { ok: true, content: { matches: [], note: "No in-stock matches. Do not invent one." } };
  return {
    ok: true,
    content: {
      matches: matches.map(v => ({
        stock_number: v.stockNumber,
        year: v.year, make: v.make, model: v.model, trim: v.trim,
        price_usd: v.price, is_new: v.isNew, mileage: v.mileage,
      })),
    },
  };
}
