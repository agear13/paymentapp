'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

const STEPS = [
  "Creating workspace",
  "Connecting systems",
  "Configuring workflows",
  "Preparing automations",
  "Creating Commercial Timeline",
  "Finalising Commercial OS",
];

export function WorkspaceProvisioningScreen() {
  const [step, setStep] = useState(0);
  const done = step >= STEPS.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), 950);
    return () => clearTimeout(t);
  }, [step, done]);

  const progress = Math.min(100, (step / STEPS.length) * 100);

  return (
    <section className="relative flex min-h-[calc(100vh-160px)] items-center px-6 py-16 animate-fade-up">
      <div className="mx-auto w-full max-w-3xl text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-purple opacity-40 blur-2xl" />
          <div className={`relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-purple text-primary-foreground shadow-glow ${done ? "" : "animate-float"}`}>
            {done ? <Check className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
          </div>
        </div>

        <h1 className="mt-8 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
          {done ? "Your Commercial OS is live." : "Building your Commercial OS"}
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          {done
            ? "Autonomous Reconciliation has been configured on your systems."
            : "Provisioning your workspace, workflows and infrastructure."}
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${done ? 100 : progress}%` }}
            />
          </div>
          <div className="mt-2 text-[12px] text-ink-soft">
            {done ? "100% complete" : `${Math.round(progress)}% complete`}
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl gap-2 text-left">
          {STEPS.map((label, i) => {
            const isDone = i < step;
            const active = i === step && !done;
            return (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13.5px] transition-all ${
                  isDone
                    ? "border-primary/30 bg-accent text-foreground"
                    : active
                      ? "border-border bg-card text-foreground shadow-card"
                      : "border-border bg-card text-ink-soft opacity-60"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4 rounded-full border border-border" />
                )}
                <span className="font-medium">{label}</span>
              </div>
            );
          })}
        </div>

        {done && (
          <div className="mx-auto mt-10 max-w-md rounded-2xl border border-primary/20 bg-accent p-5 shadow-card animate-fade-up">
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">Next</div>
            <div className="mt-2 text-[14px] text-foreground">
              Step into your personalised Commercial Operating System.
            </div>
            <Link
              href={COMMERCIAL_OS_ROUTES.connected}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-purple px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-glow"
            >
              Connect your systems
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
