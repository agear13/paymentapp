'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

const STEPS = [
  {
    label: 'Payment rails detected',
    body: 'Wise · Airwallex · OFX · Your bank · Stripe · PayPal · Digital-dollar',
  },
  {
    label: 'Payment intelligence',
    body: 'Wise currently looks strongest for lowest indicative cost on this public search.',
  },
  {
    label: 'Change priority',
    body: 'Lowest cost → Fastest',
  },
  {
    label: 'Provvy changes recommendation',
    body: 'Digital-dollar transfer is now the strongest starting point for speed.',
  },
  {
    label: 'Connect business',
    body: 'Your actual FX, rails and supplier terms could change this. Provvy does not know them yet.',
  },
] as const;

export function LandingWatchProvvyThink() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % STEPS.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const current = STEPS[step];

  return (
    <section id="how-it-works" className="px-6 pb-6">
      <div
        className="mx-auto max-w-5xl rounded-2xl border border-border/70 bg-card/90 p-5 shadow-soft sm:p-6"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
          Watch Provvy think about a payment
        </p>
        <h2 className="mt-1 text-[22px] font-semibold tracking-tight">Australia → Indonesia</h2>
        <p className="text-[13px] text-ink-soft">A$10,000 · Supplier payment · Indicative routes only</p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {STEPS.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                index === step ? 'bg-foreground text-background' : 'bg-background text-ink-soft'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-[5.5rem] rounded-xl border border-border/70 bg-background px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-soft">
            {current.label}
          </p>
          <p className="mt-1.5 text-[16px] font-medium leading-snug">{current.body}</p>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-ink-soft">
            This is the same public comparison anyone can run above. It is not a live quote.
          </p>
          <Link
            href={COMMERCIAL_OS_ROUTES.assessment}
            className="text-[13px] font-medium text-primary"
          >
            Personalised recommendation →
          </Link>
        </div>
      </div>
    </section>
  );
}
