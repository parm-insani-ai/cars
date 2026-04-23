import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/inngest/client";

const Body = z.object({
  rooftopId: z.string(),
  roNumber: z.string(),
  openedAt: z.string(),
  customer: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),
  vehicle: z.object({
    year: z.number(),
    make: z.string(),
    model: z.string(),
    mileage: z.number().optional(),
    vin: z.string().optional(),
    estimatedPayoff: z.number().optional(),
    estimatedValue: z.number().optional(),
  }),
  repairTotal: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;

  // Upsert customer.
  const customer =
    (p.customer.phone &&
      (await prisma.customer.findFirst({
        where: { rooftopId: p.rooftopId, phone: p.customer.phone },
      }))) ||
    (p.customer.email &&
      (await prisma.customer.findFirst({
        where: { rooftopId: p.rooftopId, email: p.customer.email },
      }))) ||
    (await prisma.customer.create({
      data: {
        rooftopId: p.rooftopId,
        firstName: p.customer.firstName,
        lastName: p.customer.lastName,
        phone: p.customer.phone,
        email: p.customer.email,
        smsConsent: false,
      },
    }));

  // Upsert owned vehicle record.
  await prisma.ownedVehicle.upsert({
    where: { id: `${customer.id}-${p.vehicle.vin ?? p.vehicle.model}` },
    create: {
      id: `${customer.id}-${p.vehicle.vin ?? p.vehicle.model}`,
      customerId: customer.id,
      vin: p.vehicle.vin,
      year: p.vehicle.year,
      make: p.vehicle.make,
      model: p.vehicle.model,
      mileage: p.vehicle.mileage,
      estimatedPayoff: p.vehicle.estimatedPayoff,
      estimatedValue: p.vehicle.estimatedValue,
    },
    update: {
      mileage: p.vehicle.mileage,
      estimatedPayoff: p.vehicle.estimatedPayoff,
      estimatedValue: p.vehicle.estimatedValue,
    },
  });

  const ro = await prisma.serviceRO.create({
    data: {
      rooftopId: p.rooftopId,
      customerId: customer.id,
      roNumber: p.roNumber,
      openedAt: new Date(p.openedAt),
      vehicleYear: p.vehicle.year,
      vehicleMake: p.vehicle.make,
      vehicleModel: p.vehicle.model,
      mileage: p.vehicle.mileage,
      repairTotal: p.repairTotal,
    },
  });

  await inngest.send({ name: "service-ro/created", data: { serviceROId: ro.id } });
  return NextResponse.json({ ok: true, serviceROId: ro.id });
}
