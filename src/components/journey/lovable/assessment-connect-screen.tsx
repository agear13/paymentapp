'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Shield, Zap, TrendingUp } from 'lucide-react';

export function AssessmentConnectScreen() {
  const router = useRouter();

  const connect = () => {
    try {
      sessionStorage.setItem('provvy.connected', 'xero');
    } catch {}
    router.push('/journey/assessment/analysis');
  };
  const skip = () => {
    try {
      sessionStorage.setItem('provvy.connected', 'skipped');
    } catch {}
    router.push('/journey/assessment/analysis');
  };

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto max-w-3xl">
        <Link href="/journey/assessment/business" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Improve your recommendation
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          Connect your accounting so Provvy AI can analyse real workflows instead of assumptions. You can always continue without it.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[oklch(0.55_0.15_220)] text-white shadow-glow">
                <span className="text-lg font-bold">X</span>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">Recommended</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Connect Xero</div>
                <div className="mt-1 text-[13px] text-ink-soft">Read-only. Takes about 30 seconds.</div>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-accent-foreground">
              <Shield className="h-3 w-3" /> Bank-grade encryption
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Benefit icon={TrendingUp} title="+42% accuracy" desc="Real invoices, not estimates" />
            <Benefit icon={Zap} title="10× richer analysis" desc="Understand actual workflows" />
            <Benefit icon={Check} title="Tailored workflows" desc="Configured to your data" />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={connect}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Connect Xero <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={skip}
              className="rounded-xl border border-border bg-transparent px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Skip for now
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-[12px] text-ink-soft">
          Also supported: MYOB · QuickBooks · NetSuite · More coming soon
        </div>
      </div>
    </section>
  );
}

function Benefit({ icon: Icon, title, desc }: { icon: typeof Shield; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2.5 text-[14px] font-semibold text-foreground">{title}</div>
      <div className="mt-0.5 text-[12px] text-ink-soft">{desc}</div>
    </div>
  );
}
