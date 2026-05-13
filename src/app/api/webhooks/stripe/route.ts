import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Stripe webhook. Verifies signature (when configured) and flips appointment
// deposit_status to paid. Refund + failure handling kept simple for MVP.

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: any;
  try {
    if (secret && sig) {
      const modName = "stripe";
      const StripeMod = (await import(/* webpackIgnore: true */ modName as any)).default;
      const stripe = new StripeMod(process.env.STRIPE_SECRET_KEY ?? "test", { apiVersion: "2024-06-20" });
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } else {
      event = JSON.parse(raw);
    }
  } catch (err) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const apptId = session.metadata?.appointmentId;
        if (apptId) {
          await prisma.appointment.update({
            where: { id: apptId },
            data: {
              depositStatus: "paid",
              stripePaymentIntentId: session.payment_intent ?? null,
            },
          });
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object;
        const apptId = session.metadata?.appointmentId;
        if (apptId) {
          await prisma.appointment.update({
            where: { id: apptId },
            data: { depositStatus: "failed" },
          });
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const piId = charge.payment_intent;
        if (piId) {
          await prisma.appointment.updateMany({
            where: { stripePaymentIntentId: piId },
            data: { depositStatus: "refunded" },
          });
        }
        break;
      }
      default:
        // Ignore other event types.
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", err);
  }

  return NextResponse.json({ ok: true });
}
