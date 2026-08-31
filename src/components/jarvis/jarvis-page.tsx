'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Mic, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import '@/components/journey/lovable/lovable-journey.css';
import { ProvvypayLogoMark } from '@/components/provvypay/provvypay-logo-mark';
import { ProvvypayLegalFooterLinks } from '@/components/legal/provvypay-legal-links';
import { ExploreProvvyLink } from '@/components/jarvis/explore-provvy-link';
import { JarvisDemoEngine } from '@/components/jarvis/jarvis-demo-engine';
import { JarvisWaitlistForm } from '@/components/jarvis/jarvis-waitlist-form';
import { JARVIS_GA_EVENTS, trackGaEvent } from '@/lib/analytics/track-ga-event';

const EXAMPLES = [
  'Get everyone to approve the agreement and tell me who’s holding it up.',
  'Make sure everyone has provided their payout details before settlement.',
  'Follow up with the overdue customers and tell me what needs my attention.',
  'Prepare everything for tomorrow’s payments.',
];

export function JarvisPage() {
  useEffect(() => {
    trackGaEvent(JARVIS_GA_EVENTS.landingView);
  }, []);

  return (
    <div className="lovable-journey dark min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-70" />
      <div className="relative">
        <header className="glass sticky top-2 z-50 mx-auto w-[min(1200px,calc(100%-1.5rem))] rounded-2xl px-3 py-2.5 shadow-soft sm:top-4 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Provvy home">
              <ProvvypayLogoMark href="" showWordmark={false} size="sm" className="[&>div]:h-7 [&>div]:w-7" />
              <span className="truncate text-[15px] font-semibold tracking-tight">Provvy</span>
            </Link>
            <a
              href="#hero-waitlist"
              className="inline-flex h-10 shrink-0 items-center rounded-xl bg-gradient-purple px-3 text-[13px] font-medium text-primary-foreground shadow-glow sm:px-4"
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Join the waitlist</span>
            </a>
          </div>
        </header>

        <section className="px-5 pb-3 pt-4 sm:px-6 sm:pb-8 sm:pt-12">
          <div className="mx-auto max-w-6xl">
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-accent-foreground sm:text-[12px]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Early access waitlist
            </div>
            <h1 className="mt-3 max-w-full text-[1.7rem] font-semibold leading-[1.12] tracking-[-0.04em] sm:mt-5 sm:max-w-4xl sm:text-6xl sm:leading-[1.08]">
              Meet Jarvis for your business.
            </h1>
            <p className="mt-3 max-w-2xl text-[1.05rem] font-medium tracking-[-0.02em] sm:mt-4 sm:text-[1.3rem]">
              Talk to Provvy. It gets the work done.
            </p>
            <p className="mt-2 max-w-full text-[14.5px] leading-relaxed text-ink-soft sm:mt-3 sm:max-w-2xl sm:text-[16px]">
              Soon you’ll be able to speak to Provvy the way you’d brief an operator. This capability
              is not generally available yet.
            </p>
          </div>
        </section>

        <section className="px-5 py-1 sm:px-6 sm:py-5" aria-labelledby="jarvis-demo-heading">
          <div className="mx-auto max-w-3xl">
            <p
              id="jarvis-demo-heading"
              className="text-center text-[11px] font-medium uppercase tracking-wider text-ink-soft"
            >
              See it work
            </p>
            <div className="mt-2 rounded-[1.75rem] border border-border/70 bg-card/50 px-3 py-3 shadow-card sm:mt-5 sm:px-8 sm:py-7">
              <JarvisDemoEngine />
            </div>
          </div>
        </section>

        <section className="px-5 pb-10 pt-4 sm:px-6 sm:pb-16 sm:pt-8">
          <div className="mx-auto max-w-xl">
            <h2 className="text-center text-[1.35rem] font-semibold tracking-[-0.03em] sm:text-2xl">
              Be first to speak to Provvy.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-[14px] leading-relaxed text-ink-soft">
              Join the Jarvis waitlist for early access.
            </p>
            <div className="mt-5">
              <JarvisWaitlistForm id="hero-waitlist" submitLabel="Join the waitlist" />
            </div>
            <p className="mt-5 text-center">
              <ExploreProvvyLink className="inline-flex items-center gap-1.5 text-[14px] font-medium text-primary hover:underline">
                Explore what Provvy can do today →
              </ExploreProvvyLink>
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              You say it. Provvy does it.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft sm:text-[16px]">
              Coordinating people, agreements, payments and obligations shouldn’t mean navigating
              screens. The future of Provvy is an instruction: speak naturally, and Provvy carries
              the work across the commercial workflows it already understands.
            </p>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              What you might say
            </h2>
            <p className="mt-3 max-w-2xl text-[14.5px] text-ink-soft">
              Examples of the intended future experience — not capabilities you can use from this
              page today.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {EXAMPLES.map((example) => (
                <li
                  key={example}
                  className="rounded-2xl border border-border/70 bg-card/70 p-5 text-[14.5px] leading-relaxed shadow-soft"
                >
                  <span className="text-ink-soft">“</span>
                  {example}
                  <span className="text-ink-soft">”</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="px-5 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <Mic className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[16px] font-semibold">Voice is the interface</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                You give an instruction instead of operating software. The differentiator is not
                speech-to-text on its own.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <Workflow className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[16px] font-semibold">Context becomes action</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Provvy already holds the commercial graph — people, agreements, obligations and
                settlement state — so an instruction can become coordinated work.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-[16px] font-semibold">Controls stay in place</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Autonomous execution is intended to respect approval boundaries. You stay in control
                of what gets released.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-xl rounded-3xl border border-primary/20 bg-card/80 p-6 shadow-card sm:p-10">
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">
              Join the Jarvis waitlist
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
              Be first to speak to Provvy when this opens for early access.
            </p>
            <div className="mt-6">
              <JarvisWaitlistForm />
            </div>
          </div>
        </section>

        <footer className="border-t border-border/60 px-5 py-12 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ProvvypayLogoMark href="" showWordmark={false} size="sm" className="[&>div]:h-7 [&>div]:w-7" />
              <span className="text-[15px] font-semibold tracking-tight">Provvy</span>
            </div>
            <ProvvypayLegalFooterLinks
              className="flex flex-wrap items-center gap-5 text-[13px] text-ink-soft"
              linkClassName="transition-colors hover:text-foreground"
            />
            <p className="text-[12px] text-ink-soft">
              © {new Date().getFullYear()} Provvy. Jarvis is a future capability on the waitlist.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
