'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";
import { Brain, Check, Loader2 } from "lucide-react";


const STEPS = [
  "Connecting accounting",
  "Reading invoices",
  "Understanding agreements",
  "Mapping workflows",
  "Detecting opportunities",
  "Building recommendations",
];

export function AssessmentAnalysisScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [impact, setImpact] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(() => router.push("/journey/recommendation"), 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 1100);
    return () => clearTimeout(t);
  }, [step, router]);

  useEffect(() => {
    const target = Math.round((step / STEPS.length) * 148000);
    const start = impact;
    const startTime = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startTime) / duration);
      setImpact(Math.round(start + (target - start) * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
     
  }, [step]);

  const progress = (step / STEPS.length) * 100;

  return (
    <section className="relative flex min-h-[calc(100vh-160px)] items-center px-6 py-16 animate-fade-up">
      <div className="mx-auto w-full max-w-3xl text-center">
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <div className="absolute inset-0 animate-pulse-glow rounded-full bg-gradient-purple opacity-40 blur-2xl" />
          <div className="relative grid h-20 w-20 place-items-center rounded-3xl bg-gradient-purple text-primary-foreground shadow-glow animate-float">
            <Brain className="h-8 w-8" />
          </div>
        </div>

        <h1 className="mt-8 text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
          Provvy AI is understanding your business
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Analysing your systems, workflows and commercial patterns.
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-[12px] text-ink-soft">
            {Math.round(progress)}% complete
          </div>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl gap-2 text-left">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-[13.5px] transition-all ${
                  done
                    ? "border-primary/30 bg-accent text-foreground"
                    : active
                      ? "border-border bg-card text-foreground shadow-card"
                      : "border-border bg-card text-ink-soft opacity-60"
                }`}
              >
                {done ? (
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

        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-primary/20 bg-accent p-5 shadow-card">
          <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
            Estimated commercial impact
          </div>
          <div className="mt-2 text-4xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
            A${impact.toLocaleString()}
            <span className="ml-1 text-[13px] font-normal text-ink-soft">/ year</span>
          </div>
          <div className="mt-1 text-[12px] text-ink-soft">Growing as Provvy analyses more of your business.</div>
        </div>
      </div>
    </section>
  );
}
