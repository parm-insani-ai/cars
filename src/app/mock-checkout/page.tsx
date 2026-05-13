import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Stand-in Stripe Checkout for dev. Lets you click "Pay" and we'll mark the
// appointment paid — no real card, no real money. Replaced by a real Stripe
// hosted page when STRIPE_SECRET_KEY is set.

export default async function MockCheckout({
  searchParams,
}: {
  searchParams: { session?: string; amount?: string; appt?: string };
}) {
  const appt = searchParams.appt
    ? await prisma.appointment.findUnique({ where: { id: searchParams.appt }, include: { business: true, service: true } })
    : null;
  const amountCents = Number(searchParams.amount ?? 0);

  return (
    <div className="max-w-md mx-auto card p-6 space-y-4 mt-12">
      <div className="text-xs uppercase tracking-wider text-ink-muted">Mock checkout (dev)</div>
      <h1 className="text-xl font-semibold">${(amountCents / 100).toFixed(2)} deposit</h1>
      {appt ? (
        <p className="text-sm text-ink-muted">
          For <strong>{appt.service.name}</strong> at <strong>{appt.business.name}</strong> on {appt.scheduledAt.toLocaleString()}.
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        This is a development page. Configure STRIPE_SECRET_KEY in .env to use real Stripe Checkout.
      </p>
      <form action="/api/mock-checkout/confirm" method="post">
        <input type="hidden" name="appt" value={searchParams.appt ?? ""} />
        <button className="btn-primary w-full" type="submit">Mark deposit as paid</button>
      </form>
      <Link href="/" className="block text-center text-xs text-ink-muted hover:underline">Cancel</Link>
    </div>
  );
}
