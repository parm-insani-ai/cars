import { PrismaClient, Vertical } from "@prisma/client";
import { packFor } from "../src/packs";

const prisma = new PrismaClient();

const SEED_ACCOUNT_NAME = "insani Demo Account";

const businesses: Array<{
  vertical: Vertical;
  name: string;
  phoneNumber: string;
  timezone: string;
  smsFromNumber: string;
  agentTransferTo: string;
}> = [
  { vertical: "dealership", name: "Demo Motors", phoneNumber: "+14155557701", timezone: "America/Los_Angeles", smsFromNumber: "+14155557701", agentTransferTo: "+14155558811" },
  { vertical: "service_shop", name: "Eastside Auto Care", phoneNumber: "+14155557702", timezone: "America/Los_Angeles", smsFromNumber: "+14155557702", agentTransferTo: "+14155558812" },
  { vertical: "wellness", name: "Cedar Wellness Studio", phoneNumber: "+14155557703", timezone: "America/Los_Angeles", smsFromNumber: "+14155557703", agentTransferTo: "+14155558813" },
];

async function main() {
  console.log("→ Clearing existing seed…");
  const existing = await prisma.account.findFirst({ where: { name: SEED_ACCOUNT_NAME } });
  if (existing) {
    const bizIds = (await prisma.business.findMany({ where: { accountId: existing.id }, select: { id: true } })).map(b => b.id);
    await prisma.followUp.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.callToolCall.deleteMany({ where: { session: { businessId: { in: bizIds } } } });
    await prisma.callTurn.deleteMany({ where: { session: { businessId: { in: bizIds } } } });
    await prisma.callSession.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.appointment.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.knowledgeArticle.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.providerShift.deleteMany({ where: { provider: { businessId: { in: bizIds } } } });
    await prisma.provider.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.service.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.ownedVehicle.deleteMany({ where: { customer: { businessId: { in: bizIds } } } });
    await prisma.customer.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.vehicle.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.aiEval.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.businessHours.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.user.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.agentConfig.deleteMany({ where: { businessId: { in: bizIds } } });
    await prisma.business.deleteMany({ where: { accountId: existing.id } });
    await prisma.account.delete({ where: { id: existing.id } });
  }

  const account = await prisma.account.create({ data: { name: SEED_ACCOUNT_NAME } });
  console.log(`→ Account ${account.id}`);

  let firstBusinessId: string | null = null;

  for (const b of businesses) {
    const pack = packFor(b.vertical);

    const business = await prisma.business.create({
      data: {
        accountId: account.id,
        name: b.name,
        vertical: b.vertical,
        timezone: b.timezone,
        phoneNumber: b.phoneNumber,
        smsFromNumber: b.smsFromNumber,
      },
    });
    if (!firstBusinessId) firstBusinessId = business.id;

    await prisma.agentConfig.create({
      data: {
        businessId: business.id,
        greeting: pack.defaultGreeting(business.name),
        personality: pack.defaultPersonality,
        voiceProvider: "11labs",
        voiceId: "default",
        language: "en-US",
        canBook: true,
        canReschedule: true,
        canCancel: true,
        canTransfer: true,
        transferTo: b.agentTransferTo,
        smsFooter: "Reply STOP to opt out. Msg & data rates may apply.",
      },
    });

    // Business hours: Mon–Sat 9–18 by default; wellness opens Tue–Sat.
    const standardHours = [1, 2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, openMin: 9 * 60, closeMin: 18 * 60 }));
    const wellnessHours = [2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, openMin: 10 * 60, closeMin: 19 * 60 }));
    const serviceHours = [1, 2, 3, 4, 5].map(d => ({ dayOfWeek: d, openMin: 8 * 60, closeMin: 18 * 60 }));
    const dealershipHours = [1, 2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, openMin: 9 * 60, closeMin: d === 6 ? 17 * 60 : 19 * 60 }));
    const hours =
      b.vertical === "wellness" ? wellnessHours :
      b.vertical === "service_shop" ? serviceHours :
      b.vertical === "dealership" ? dealershipHours : standardHours;
    for (const h of hours) {
      await prisma.businessHours.create({ data: { businessId: business.id, ...h } });
    }

    // Services.
    const serviceMap = new Map<string, string>();
    for (const s of pack.services) {
      const created = await prisma.service.create({
        data: {
          businessId: business.id,
          name: s.name,
          category: s.category,
          durationMin: s.durationMin,
          priceUsd: s.priceUsd,
          description: s.description,
          providerKind: s.providerKind,
        },
      });
      serviceMap.set(s.name, created.id);
    }

    // Providers + shifts.
    for (const p of pack.providers) {
      const provider = await prisma.provider.create({
        data: { businessId: business.id, name: p.name, kind: p.kind },
      });
      for (const s of p.shifts) {
        await prisma.providerShift.create({
          data: { providerId: provider.id, dayOfWeek: s.dayOfWeek, startMin: s.startMin, endMin: s.endMin },
        });
      }
    }

    // Knowledge.
    for (const k of pack.knowledge) {
      await prisma.knowledgeArticle.create({
        data: { businessId: business.id, title: k.title, body: k.body, tags: k.tags ?? [] },
      });
    }

    // One staff user per business so the login picker has options.
    await prisma.user.create({
      data: {
        businessId: business.id,
        email: `${b.vertical}@demo.insani.local`,
        name: roleLeadName(b.vertical),
        role: "owner",
      },
    });

    // Inventory for the dealership pack.
    if (b.vertical === "dealership") {
      const inv = [
        { stockNumber: "N4821", year: 2024, make: "Toyota", model: "RAV4", trim: "XLE", bodyType: "suv", fuel: "hybrid", price: 34990, isNew: true },
        { stockNumber: "N4822", year: 2024, make: "Toyota", model: "Camry", trim: "SE", bodyType: "sedan", fuel: "gas", price: 29995, isNew: true },
        { stockNumber: "N4901", year: 2024, make: "Honda", model: "CR-V", trim: "EX-L", bodyType: "suv", fuel: "gas", price: 33995, isNew: true },
        { stockNumber: "U2210", year: 2021, make: "Toyota", model: "Highlander", trim: "XLE", bodyType: "suv", fuel: "gas", mileage: 42000, price: 31995, isNew: false },
        { stockNumber: "N4930", year: 2024, make: "Ford", model: "F-150", trim: "XLT", bodyType: "truck", fuel: "gas", price: 48995, isNew: true },
        { stockNumber: "N5002", year: 2024, make: "Hyundai", model: "Ioniq 5", trim: "SEL", bodyType: "suv", fuel: "ev", price: 42995, isNew: true },
      ];
      for (const v of inv) await prisma.vehicle.create({ data: { businessId: business.id, ...v } });
    }

    console.log(`  + ${business.name} (${b.vertical}) — ${b.phoneNumber}`);
  }

  // The operator account — an admin who can reach the internal GTM / outreach
  // engine (the /outreach routes are gated to role=admin).
  if (firstBusinessId) {
    await prisma.user.create({
      data: {
        businessId: firstBusinessId,
        email: "operator@demo.insani.local",
        name: "Operator (GTM admin)",
        role: "admin",
      },
    });
  }

  // Print convenience info for the login picker.
  const users = await prisma.user.findMany({ include: { business: true } });
  console.log("\nLogin as any of:");
  for (const u of users) console.log(`  ${u.name.padEnd(22)} — ${u.email} (${u.business.name})`);
  console.log("\nDone. Run npm run dev and open http://localhost:3000.");
}

function roleLeadName(v: Vertical): string {
  if (v === "dealership") return "Pat Lopez (Demo Motors)";
  if (v === "service_shop") return "Jamie Bishara (Eastside)";
  return "Riley Kim (Cedar)";
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
