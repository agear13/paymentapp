'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Sparkles,
  TrendingUp,
  Workflow,
  Brain,
} from "lucide-react";


const CAPABILITIES = [
  "Automatically match payments to invoices",
  "Reconcile across Stripe, GoCardless and bank feeds",
  "Detect and flag discrepancies in real time",
  "Post journals to Xero without manual entry",
  "Handle partial payments and multi-currency",
  "Generate reconciliation reports on demand",
];

export function WorkflowRecommendationScreen() {
  const router = useRouter();

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto max-w-5xl">
        <Link href="/journey/assessment/analysis" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
          <Sparkles className="h-3 w-3 text-primary" />
          Provvy AI recommends
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          Here's what we'd deliver.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">
          One commercial workflow, deployed on top of the systems you already use.
        </p>

        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-8">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-purple text-primary-foreground shadow-glow">
                <Workflow className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">Commercial Workflow</div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Autonomous Reconciliation</h2>
                <p className="mt-2 max-w-xl text-[14px] text-ink-soft">
                  End-to-end reconciliation between your payments, invoicing and accounting — running continuously in the background.
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-medium text-accent-foreground">
              <Check className="h-3 w-3" /> Best fit for your business
            </div>
          </div>

          <div className="grid gap-6 p-8 md:grid-cols-3">
            <Metric icon={Clock} label="Estimated time saved" value="32 hrs / week" />
            <Metric icon={TrendingUp} label="Business impact" value="A$148,000 / yr" />
            <Metric icon={Sparkles} label="Deployment" value="Under 48 hours" />
          </div>

          <div className="grid gap-8 border-t border-border p-8 md:grid-cols-2">
            <div>
              <div className="text-[13px] font-semibold text-foreground">Included capabilities</div>
              <ul className="mt-4 space-y-2.5">
                {CAPABILITIES.map((c) => (
                  <li key={c} className="flex items-start gap-2.5 text-[13.5px] text-foreground">
                    <div className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                <Brain className="h-3.5 w-3.5 text-primary" />
                Commercial reasoning
              </div>
              <div className="mt-4 space-y-4 text-[13.5px] leading-relaxed text-ink-soft">
                <p>
                  Your team spends the majority of their finance admin on matching payments to invoices — the highest-volume, lowest-value work in your commercial stack.
                </p>
                <p>
                  Because you already use Xero and process payments through multiple rails, autonomous reconciliation is the single workflow that will remove the most repeatable admin while improving cashflow visibility immediately.
                </p>
                <p className="rounded-xl border border-primary/20 bg-accent p-3.5 text-foreground">
                  Deploying this first creates the data foundation for later workflows — forecasting, revenue sharing and reporting all run cleaner once reconciliation is autonomous.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-secondary p-6">
            <div className="text-[12.5px] text-ink-soft">
              You'll be able to review and adjust everything before it goes live.
            </div>
            <button
              onClick={() => router.push("/journey/provisioning")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Create my Commercial OS <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary p-5">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-ink-soft">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}
