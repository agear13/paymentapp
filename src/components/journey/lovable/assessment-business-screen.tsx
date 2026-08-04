'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ArrowRight, Brain, Check, Loader2, ArrowLeft } from "lucide-react";


const INDUSTRIES = ["Professional services", "E-commerce", "SaaS / Technology", "Construction / Trades", "Hospitality", "Healthcare", "Other"];
const SIZES = ["1–5", "6–20", "21–50", "51–200", "200+"];
const ACCOUNTING = ["Xero", "MYOB", "QuickBooks", "NetSuite", "None / Spreadsheets"];
const CHALLENGES = ["Late payments", "Manual reconciliation", "Fragmented systems", "Poor cashflow visibility", "Reporting takes days"];
const SYSTEMS = ["Stripe", "GoCardless", "HubSpot", "Salesforce", "Shopify", "Slack", "Google Workspace", "Microsoft 365"];

type State = {
  industry: string;
  size: string;
  accounting: string;
  challenge: string;
  systems: string[];
};

export function AssessmentBusinessScreen() {
  const router = useRouter();
  const [s, setS] = useState<State>({ industry: "", size: "", accounting: "", challenge: "", systems: [] });

  const filled = useMemo(
    () => [!!s.industry, !!s.size, !!s.accounting, !!s.challenge, s.systems.length > 0].filter(Boolean).length,
    [s],
  );

  const toggleSystem = (name: string) =>
    setS((p) => ({ ...p, systems: p.systems.includes(name) ? p.systems.filter((x) => x !== name) : [...p.systems, name] }));

  const canContinue = filled >= 4;

  const handleContinue = () => {
    try {
      sessionStorage.setItem("provvy.business", JSON.stringify(s));
    } catch {}
    router.push('/journey/assessment/analysis');
  };

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <Link href="/journey/assessment" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Tell us about your business
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            High-level context is enough. Provvy AI will infer the rest.
          </p>

          <div className="mt-10 space-y-8">
            <Field label="Industry">
              <Chips options={INDUSTRIES} value={s.industry} onChange={(v) => setS({ ...s, industry: v })} />
            </Field>
            <Field label="Business size">
              <Chips options={SIZES} value={s.size} onChange={(v) => setS({ ...s, size: v })} suffix=" people" />
            </Field>
            <Field label="Accounting software">
              <Chips options={ACCOUNTING} value={s.accounting} onChange={(v) => setS({ ...s, accounting: v })} />
            </Field>
            <Field label="Primary challenge">
              <Chips options={CHALLENGES} value={s.challenge} onChange={(v) => setS({ ...s, challenge: v })} />
            </Field>
            <Field label="Current systems" hint="Select all that apply">
              <div className="flex flex-wrap gap-2">
                {SYSTEMS.map((sys) => {
                  const active = s.systems.includes(sys);
                  return (
                    <button
                      key={sys}
                      onClick={() => toggleSystem(sys)}
                      className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-glow"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
                      }`}
                    >
                      {sys}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <div className="mt-12 flex items-center justify-between">
            <div className="text-[13px] text-ink-soft">{filled} of 5 answered</div>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <AIPanel state={s} filled={filled} />
      </div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <label className="text-[13px] font-medium text-foreground">{label}</label>
        {hint && <span className="text-[12px] text-ink-soft">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange, suffix = "" }: { options: string[]; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all ${
              active
                ? "border-primary bg-primary text-primary-foreground shadow-glow"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
            }`}
          >
            {o}
            {suffix}
          </button>
        );
      })}
    </div>
  );
}

const AI_STEPS = [
  { threshold: 1, label: "Understanding your business" },
  { threshold: 2, label: "Mapping commercial workflows" },
  { threshold: 3, label: "Detecting automation opportunities" },
  { threshold: 4, label: "Identifying commercial bottlenecks" },
  { threshold: 5, label: "Ready to recommend a workflow" },
];

function AIPanel({ state, filled }: { state: State; filled: number }) {
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-foreground">Provvy AI</div>
            <div className="text-[11px] text-ink-soft">Analysing in real time</div>
          </div>
          <div className="ml-auto flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Live
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {AI_STEPS.map((step, i) => {
            const done = filled >= step.threshold;
            const active = filled === step.threshold - 1;
            return (
              <div
                key={step.label}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-[12.5px] transition-all ${
                  done
                    ? "border-primary/30 bg-accent text-foreground"
                    : active
                      ? "border-border bg-secondary text-foreground"
                      : "border-border bg-card text-ink-soft"
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-border" />
                )}
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>

        {filled >= 3 && (
          <div className="mt-5 rounded-xl border border-primary/20 bg-accent p-3.5 animate-fade-up">
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">Early signal</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-foreground">
              Based on your {state.industry || "profile"}
              {state.challenge && <> and challenge with <em className="not-italic font-medium">{state.challenge.toLowerCase()}</em></>},
              autonomous reconciliation looks like a strong first workflow.
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
