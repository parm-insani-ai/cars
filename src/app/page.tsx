import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <div className="flex-1">
        <Hero />
        <SocialProof />
        <Problems />
        <HowItWorks />
        <FinalCta />
      </div>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="px-6 py-5 border-b border-surface-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-lg">insani</Link>
        <nav className="flex items-center gap-2 md:gap-4">
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink px-2 py-1">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary text-sm">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="px-6 py-20 md:py-28">
      <div className="max-w-4xl mx-auto text-center space-y-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lane/10 text-lane text-xs font-medium">
          <span className="h-2 w-2 rounded-full bg-lane animate-pulse" />
          Built for service businesses
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-balance">
          The AI employee that <span className="text-lane">never misses a call</span>.
        </h1>
        <p className="text-lg md:text-xl text-ink-muted max-w-2xl mx-auto text-balance">
          insani&apos;s AI employee answers every call, books appointments, follows up, and carries out tasks specific to your business — 24/7, for a fraction of a part-time hire.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">
            Start free trial →
          </Link>
          <Link href="/login" className="btn-secondary text-base px-6 py-3">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-ink-muted">No credit card required · Set up in 5 minutes</p>
      </div>
    </section>
  );
}

function SocialProof() {
  return (
    <section className="px-6 py-10 border-y border-surface-border bg-surface-sub/40">
      <div className="max-w-5xl mx-auto text-center space-y-3">
        <p className="text-xs uppercase tracking-wide text-ink-muted font-semibold">
          The cost of missed calls
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <Stat value="62%" label="of calls to small businesses go unanswered" />
          <Stat value="$1,200" label="lost per month by the average service business" />
          <Stat value="85%" label="of callers won't leave a voicemail" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-lane">{value}</div>
      <div className="text-sm text-ink-muted mt-1">{label}</div>
    </div>
  );
}

function Problems() {
  const items = [
    {
      title: "Every missed call is a lost customer.",
      body: "When the phone rings during a service, you can't always answer. The caller hangs up and books with whoever picks up first.",
    },
    {
      title: "Hiring a receptionist costs $40k+.",
      body: "A part-time front-desk hire is more than most small businesses can justify — until they realize they've already been losing more than that in missed calls.",
    },
    {
      title: "Answering services miss context.",
      body: "Generic call centers don't know your prices, your hours, or what you actually offer. They take messages — they don't close bookings.",
    },
  ];

  return (
    <section className="px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            You&apos;ve felt this before.
          </h2>
          <p className="text-ink-muted max-w-xl mx-auto">
            insani fixes the gap between a ringing phone and a booked appointment.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map(it => (
            <div key={it.title} className="card p-6 space-y-2">
              <h3 className="font-semibold">{it.title}</h3>
              <p className="text-sm text-ink-muted">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Tell us about your business",
      body: "Hours, services, prices, your tone of voice. Five-minute setup wizard.",
    },
    {
      n: "2",
      title: "We forward your calls",
      body: "Keep your existing number or use ours. insani picks up when you can't.",
    },
    {
      n: "3",
      title: "Bookings show up in your dashboard",
      body: "Confirmed appointments, recorded calls, customer profiles — all in one place.",
    },
  ];

  return (
    <section className="px-6 py-20 bg-surface-sub/40 border-y border-surface-border">
      <div className="max-w-5xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">How it works</h2>
          <p className="text-ink-muted">From signup to first call in under five minutes.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map(s => (
            <div key={s.n} className="card p-6 space-y-3">
              <div className="h-10 w-10 rounded-full bg-lane text-white flex items-center justify-center font-bold">
                {s.n}
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-ink-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 py-24">
      <div className="max-w-3xl mx-auto text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
          Stop losing customers to voicemail.
        </h2>
        <p className="text-ink-muted text-lg max-w-xl mx-auto">
          Hear it for yourself first. Then sign up and have your own AI employee answering calls today.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">
            Create your account →
          </Link>
          <Link href="/login" className="btn-secondary text-base px-6 py-3">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-10 border-t border-surface-border text-sm text-ink-muted">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>© {new Date().getFullYear()} insani</div>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-ink">Sign in</Link>
          <Link href="/signup" className="hover:text-ink">Sign up</Link>
        </div>
      </div>
    </footer>
  );
}
