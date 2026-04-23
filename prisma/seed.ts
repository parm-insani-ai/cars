import { PrismaClient } from "@prisma/client";
import { ingestLead } from "../src/domain/leads";
import { processServiceDrive } from "../src/domain/opportunities";

const prisma = new PrismaClient();

async function main() {
  // Idempotent-ish: delete seeded rooftop if present.
  const existing = await prisma.rooftop.findFirst({ where: { name: "Demo Motors" } });
  if (existing) {
    console.log("Clearing existing Demo Motors rooftop…");
    // Cascade delete relies on our schema order; do it manually.
    await prisma.message.deleteMany({ where: { lead: { rooftopId: existing.id } } });
    await prisma.recommendation.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.task.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.appointment.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.opportunity.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.serviceRO.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.transcript.deleteMany({ where: { call: { rooftopId: existing.id } } });
    await prisma.callEvent.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.lead.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.ownedVehicle.deleteMany({ where: { customer: { rooftopId: existing.id } } });
    await prisma.customer.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.vehicle.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.score.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.alert.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.user.deleteMany({ where: { rooftopId: existing.id } });
    await prisma.rooftop.delete({ where: { id: existing.id } });
  }

  const group = await prisma.dealerGroup.create({ data: { name: "Demo Auto Group" } });
  const rooftop = await prisma.rooftop.create({
    data: {
      groupId: group.id,
      name: "Demo Motors",
      timezone: "America/Los_Angeles",
      voiceProfile:
        "Warm, concise, and direct — the way our top-performing rep Marcus texts. Lead with the customer's specific interest, one short question, end with a specific time offer.",
      consentTemplate: "Reply STOP to opt out. Msg & data rates may apply.",
    },
  });

  // Users
  const manager = await prisma.user.create({
    data: { rooftopId: rooftop.id, email: "gsm@demo.com", name: "Pat Lopez", role: "sales_manager" },
  });
  const reps = await Promise.all(
    ["Marcus Chen", "Ava Washington", "Diego Ruiz"].map((name, i) =>
      prisma.user.create({
        data: {
          rooftopId: rooftop.id,
          email: `rep${i}@demo.com`,
          name,
          role: "rep",
          phone: `+1415555010${i}`,
        },
      }),
    ),
  );

  // Inventory
  const inventory = [
    { stockNumber: "N4821", year: 2024, make: "Toyota", model: "RAV4", trim: "XLE", bodyType: "suv", fuel: "hybrid", price: 34990, isNew: true },
    { stockNumber: "N4822", year: 2024, make: "Toyota", model: "Camry", trim: "SE", bodyType: "sedan", fuel: "gas", price: 29995, isNew: true },
    { stockNumber: "N4901", year: 2024, make: "Honda", model: "CR-V", trim: "EX-L", bodyType: "suv", fuel: "gas", price: 33995, isNew: true },
    { stockNumber: "U2210", year: 2021, make: "Toyota", model: "Highlander", trim: "XLE", bodyType: "suv", fuel: "gas", mileage: 42000, price: 31995, isNew: false },
    { stockNumber: "U2214", year: 2022, make: "Honda", model: "Accord", trim: "Sport", bodyType: "sedan", fuel: "gas", mileage: 28000, price: 26995, isNew: false },
    { stockNumber: "N4930", year: 2024, make: "Ford", model: "F-150", trim: "XLT", bodyType: "truck", fuel: "gas", price: 48995, isNew: true },
    { stockNumber: "N5002", year: 2024, make: "Hyundai", model: "Ioniq 5", trim: "SEL", bodyType: "suv", fuel: "ev", price: 42995, isNew: true },
  ];
  const vehicles = await Promise.all(
    inventory.map((v) => prisma.vehicle.create({ data: { rooftopId: rooftop.id, ...v } })),
  );

  // Lead 1: fresh CarGurus lead interested in RAV4 — triggers first-response draft task.
  await ingestLead({
    rooftopId: rooftop.id,
    source: "cargurus",
    customer: { firstName: "Jamie", lastName: "Park", phone: "+14155550201", email: "jamie@example.com" },
    vehicleOfInterest: { stockNumber: "N4821" },
  });

  // Lead 2: 90-minute-old website lead with no vehicle of interest.
  const lead2 = await ingestLead({
    rooftopId: rooftop.id,
    source: "website",
    customer: { firstName: "Renee", lastName: "Alvarez", phone: "+14155550202", email: "renee@example.com" },
  });
  await prisma.lead.update({
    where: { id: lead2.leadId },
    data: { createdAt: new Date(Date.now() - 90 * 60_000) },
  });

  // Lead 3: stale reactivation lead from 5 days ago
  const lead3 = await ingestLead({
    rooftopId: rooftop.id,
    source: "autotrader",
    customer: { firstName: "Samir", lastName: "Khan", phone: "+14155550203" },
    vehicleOfInterest: { stockNumber: "U2214" },
  });
  await prisma.lead.update({
    where: { id: lead3.leadId },
    data: { createdAt: new Date(Date.now() - 5 * 24 * 60 * 60_000) },
  });

  // Missed call from a known customer
  const knownCustomer = await prisma.customer.findFirst({ where: { rooftopId: rooftop.id, phone: "+14155550201" } });
  const call = await prisma.callEvent.create({
    data: {
      rooftopId: rooftop.id,
      direction: "inbound",
      outcome: "missed",
      fromNumber: "+14155550201",
      toNumber: "+14155557777",
      startedAt: new Date(Date.now() - 4 * 60_000),
      endedAt: new Date(Date.now() - 3 * 60_000),
      durationSec: 42,
      customerId: knownCustomer?.id,
      department: "sales",
    },
  });
  // Create recovery task manually (workflow would be triggered via Inngest in prod)
  const targetRep = reps[0];
  await prisma.task.create({
    data: {
      rooftopId: rooftop.id,
      userId: targetRep.id,
      kind: "missed_call_recovery",
      title: `Missed sales call — +1 415 555 0201 (Jamie Park)`,
      body: `Call received 4m ago. Draft is ready.`,
      slaAt: new Date(Date.now() + 15 * 60_000),
      priority: 0.9,
    },
  });
  await prisma.recommendation.create({
    data: {
      rooftopId: rooftop.id,
      userId: targetRep.id,
      draftChannel: "sms",
      draftBody:
        "Hi Jamie, this is Marcus at Demo Motors — sorry I missed your call. Happy to hop on now or set a time. Do 5:30pm today or 11am tomorrow work? Reply STOP to opt out.",
      model: "claude-sonnet-4-6",
      rationale: "Missed-call callback draft (seeded).",
    },
  });

  // Service RO in progress (triggers equity opportunity)
  const svcCustomer = await prisma.customer.create({
    data: {
      rooftopId: rooftop.id,
      firstName: "Lydia",
      lastName: "Grant",
      phone: "+14155550301",
      email: "lydia@example.com",
      smsConsent: true,
    },
  });
  await prisma.ownedVehicle.create({
    data: {
      customerId: svcCustomer.id,
      year: 2020,
      make: "Toyota",
      model: "RAV4",
      mileage: 68500,
      estimatedPayoff: 9500,
      estimatedValue: 23000, // ~$13.5k equity
      purchaseDate: new Date(2020, 4, 1),
    },
  });
  const ro = await prisma.serviceRO.create({
    data: {
      rooftopId: rooftop.id,
      customerId: svcCustomer.id,
      roNumber: "RO-48210",
      openedAt: new Date(Date.now() - 30 * 60_000),
      vehicleYear: 2020,
      vehicleMake: "Toyota",
      vehicleModel: "RAV4",
      mileage: 68500,
      repairTotal: 1850,
    },
  });
  await processServiceDrive(ro.id);

  // A clean earlier conversion for KPI texture
  const soldCustomer = await prisma.customer.create({
    data: { rooftopId: rooftop.id, firstName: "Rami", lastName: "Bishara", phone: "+14155550401", smsConsent: true },
  });
  await prisma.appointment.create({
    data: {
      rooftopId: rooftop.id,
      customerId: soldCustomer.id,
      repId: reps[1].id,
      vehicleId: vehicles[0].id,
      scheduledAt: new Date(),
      status: "sold",
      source: "ai",
    },
  });

  console.log(`Seeded rooftop ${rooftop.id}.`);
  console.log(`Rep feed: /rep/${reps[0].id}`);
  console.log(`Manager:  /manager`);
  console.log(`Service:  /service`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
