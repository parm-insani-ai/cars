// Stripe adapter — creates Checkout sessions for deposits / cards on file.
// Lazy-loads the Stripe SDK only when STRIPE_SECRET_KEY is set; otherwise
// returns a mock checkout URL so the rest of the flow stays exercised in dev.

export interface StripeAdapter {
  readonly provider: "stripe" | "mock";
  createDepositCheckout(args: CreateDepositArgs): Promise<{ checkoutUrl: string; sessionId: string }>;
}

export type CreateDepositArgs = {
  businessName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  amountCents: number;
  appointmentId: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
};

export function stripeAdapter(): StripeAdapter {
  if (!process.env.STRIPE_SECRET_KEY) return mockStripe;
  return realStripe;
}

const mockStripe: StripeAdapter = {
  provider: "mock",
  async createDepositCheckout(args) {
    const id = `cs_mock_${Date.now()}`;
    // We point at our own /mock-checkout page for demos.
    const baseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
    return {
      sessionId: id,
      checkoutUrl: `${baseUrl}/mock-checkout?session=${id}&amount=${args.amountCents}&appt=${args.appointmentId}`,
    };
  },
};

const realStripe: StripeAdapter = {
  provider: "stripe",
  async createDepositCheckout(args) {
    // Truly dynamic import (variable so webpack doesn't trace it). Lets the
    // project build even when the `stripe` package isn't installed.
    const modName = "stripe";
    let StripeMod: any;
    try {
      StripeMod = (await import(/* webpackIgnore: true */ modName as any)).default;
    } catch {
      throw new Error("Stripe SDK not installed. Run: npm install stripe");
    }
    const stripe = new StripeMod(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${args.businessName} — appointment deposit`, description: args.description },
          unit_amount: args.amountCents,
        },
        quantity: 1,
      }],
      customer_email: args.customerEmail ?? undefined,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: { appointmentId: args.appointmentId },
    });
    return { sessionId: session.id, checkoutUrl: session.url ?? "" };
  },
};
