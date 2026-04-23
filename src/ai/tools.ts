import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

// Tool definitions exposed to the model. Every AI draft must anchor to real
// records by calling these tools — the model cannot invent inventory, prices,
// or customer facts.
export const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_inventory_matches",
    description:
      "Return up to 5 real in-stock vehicles that match the given constraints. Use this before naming any specific vehicle, price, or payment to the customer.",
    input_schema: {
      type: "object",
      properties: {
        body_type: {
          type: "string",
          description: "Preferred body style: sedan, suv, truck, coupe, hatchback, minivan, convertible, wagon. Optional.",
        },
        max_price: { type: "number", description: "Maximum price in USD. Optional." },
        min_price: { type: "number", description: "Minimum price in USD. Optional." },
        make: { type: "string", description: "Preferred make (Toyota, Ford, etc.). Optional." },
        model: { type: "string", description: "Preferred model. Optional." },
        fuel: { type: "string", description: "gas | hybrid | ev. Optional." },
        new_only: { type: "boolean", description: "Restrict to new vehicles only." },
      },
      required: [],
    },
  },
  {
    name: "get_customer_history",
    description:
      "Return the customer's prior vehicles owned at this dealership, last contact date, prior appointments, and any open leads. Use this to personalize any outreach.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: { type: "string" },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "get_rep_availability",
    description:
      "Return two concrete time slots within the next 3 business days that the rep is free. Use this when proposing appointment times to the customer.",
    input_schema: {
      type: "object",
      properties: {
        rep_id: { type: "string" },
      },
      required: ["rep_id"],
    },
  },
];

export type ToolResult = { content: string; is_error?: boolean };

export async function executeTool(
  rooftopId: string,
  name: string,
  input: unknown,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_inventory_matches":
        return await getInventoryMatches(rooftopId, input as InventoryQuery);
      case "get_customer_history":
        return await getCustomerHistory(rooftopId, input as { customer_id: string });
      case "get_rep_availability":
        return await getRepAvailability(rooftopId, input as { rep_id: string });
      default:
        return { content: `Unknown tool: ${name}`, is_error: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: `Tool error: ${msg}`, is_error: true };
  }
}

type InventoryQuery = {
  body_type?: string;
  max_price?: number;
  min_price?: number;
  make?: string;
  model?: string;
  fuel?: string;
  new_only?: boolean;
};

async function getInventoryMatches(rooftopId: string, q: InventoryQuery): Promise<ToolResult> {
  const matches = await prisma.vehicle.findMany({
    where: {
      rooftopId,
      status: "in_stock",
      ...(q.body_type ? { bodyType: q.body_type.toLowerCase() } : {}),
      ...(q.make ? { make: { equals: q.make, mode: "insensitive" } } : {}),
      ...(q.model ? { model: { contains: q.model, mode: "insensitive" } } : {}),
      ...(q.fuel ? { fuel: q.fuel.toLowerCase() } : {}),
      ...(q.new_only ? { isNew: true } : {}),
      ...(q.min_price || q.max_price
        ? { price: { gte: q.min_price ?? 0, lte: q.max_price ?? 1_000_000 } }
        : {}),
    },
    take: 5,
    orderBy: { price: "asc" },
  });

  if (matches.length === 0) {
    return { content: JSON.stringify({ matches: [], note: "No in-stock matches. Do not fabricate one." }) };
  }

  return {
    content: JSON.stringify({
      matches: matches.map((v) => ({
        stock_number: v.stockNumber,
        year: v.year,
        make: v.make,
        model: v.model,
        trim: v.trim,
        body_type: v.bodyType,
        price_usd: v.price,
        mileage: v.mileage,
        is_new: v.isNew,
      })),
    }),
  };
}

async function getCustomerHistory(rooftopId: string, q: { customer_id: string }): Promise<ToolResult> {
  const customer = await prisma.customer.findFirst({
    where: { rooftopId, id: q.customer_id },
    include: {
      vehiclesOwned: { take: 3, orderBy: { purchaseDate: "desc" } },
      leads: { take: 3, orderBy: { createdAt: "desc" }, include: { interestVehicle: true } },
    },
  });
  if (!customer) return { content: JSON.stringify({ error: "customer_not_found" }), is_error: true };

  return {
    content: JSON.stringify({
      first_name: customer.firstName,
      last_name: customer.lastName,
      last_contact_at: customer.lastContactAt,
      tags: customer.tags,
      vehicles_owned: customer.vehiclesOwned.map((v) => ({
        year: v.year,
        make: v.make,
        model: v.model,
        mileage: v.mileage,
        estimated_payoff_usd: v.estimatedPayoff,
        estimated_value_usd: v.estimatedValue,
      })),
      recent_leads: customer.leads.map((l) => ({
        source: l.source,
        status: l.status,
        interest: l.interestVehicle
          ? `${l.interestVehicle.year} ${l.interestVehicle.make} ${l.interestVehicle.model}`
          : null,
        created_at: l.createdAt,
      })),
    }),
  };
}

async function getRepAvailability(rooftopId: string, q: { rep_id: string }): Promise<ToolResult> {
  // MVP: deterministic placeholder slots. Real implementation hits CRM/calendar.
  const rep = await prisma.user.findFirst({ where: { rooftopId, id: q.rep_id } });
  if (!rep) return { content: JSON.stringify({ error: "rep_not_found" }), is_error: true };

  const now = new Date();
  const slot = (day: number, hour: number) => {
    const d = addDays(now, day);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };

  return {
    content: JSON.stringify({
      rep_name: rep.name,
      slots: [slot(1, 11), slot(1, 17), slot(2, 10)],
    }),
  };
}
