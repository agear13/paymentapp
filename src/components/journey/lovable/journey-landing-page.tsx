'use client';

import './lovable-journey.css';
import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import { LandingPaymentSearch } from '@/components/journey/lovable/landing-payment-search';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Beaker,
  Calendar,
  Check,
  Clock,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { WORKFLOW_LIBRARY } from '@/lib/journey/workflow-library-catalog';
import { PLAN_CATALOG, PLAN_CATALOG_ORDER } from '@/lib/plans/plan-catalog';
import { PROVVYPAY_PRIVACY_PATH, PROVVYPAY_TERMS_PATH } from '@/lib/legal/provvypay-legal-paths';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';
import { LandingAdvisorProvider } from '@/components/journey/lovable/landing-advisor-context';
import { LandingAdvisor } from '@/components/journey/lovable/landing-advisor';
import { LandingIntelligenceProvider } from '@/components/journey/lovable/landing-intelligence-context';
import { LandingPaymentIntelligence } from '@/components/journey/lovable/landing-payment-intelligence';
import { LandingPaymentIntelligenceSubscribe } from '@/components/journey/lovable/landing-payment-intelligence-subscribe';
import { LandingPublicToPersonal } from '@/components/journey/lovable/landing-public-to-personal';
import { LandingRailWatchlist } from '@/components/journey/lovable/landing-rail-watchlist';
import { LandingWatchProvvyThink } from '@/components/journey/lovable/landing-watch-provvy-think';

const LANDING_NAV = [
  { label: 'Explore', href: '#compare' },
  { label: 'Intelligence', href: '#payment-intelligence' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Workflows', href: '#workflow-library' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Provvy Labs', href: '/labs' },
] as const;

const LANDING_WORKFLOWS = WORKFLOW_LIBRARY.filter((entry) =>
  [
    'autonomous-reconciliation',
    'payment-collection',
    'cashflow-forecasting',
    'revenue-sharing',
    'supplier-payments',
    'commercial-operations',
  ].includes(entry.slug)
);

const PRODUCT_LAYERS = [
  {
    title: 'Discovery is public.',
    body: 'Anyone can explore payment routes.',
  },
  {
    title: 'Intelligence is personalised.',
    body: 'Connecting business context lets Provvy determine what is actually optimal for that business.',
  },
  {
    title: 'Execution is authorised.',
    body: 'Provvy never silently takes control. The owner decides what Provvy can recommend, approve and eventually automate.',
  },
] as const;

export function JourneyLandingPage() {
  const { dark, toggle } = useProvvyTheme();

  return (
    <LandingAdvisorProvider>
    <LandingIntelligenceProvider>
    <div
      className={`lovable-journey min-h-screen bg-background text-foreground overflow-x-hidden antialiased ${dark ? 'dark' : ''}`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <Nav dark={dark} onToggleDark={toggle} />
        <Hero />
        <LandingRailWatchlist />
        <LandingWatchProvvyThink />
        <LandingPublicToPersonal />
        <WorkflowLibrary />
        <ContextReveal />
        <Pricing />
        <Labs />
        <Footer />
      </div>
      <LandingAdvisor />
    </div>
    </LandingIntelligenceProvider>
    </LandingAdvisorProvider>
  );
}

function Nav({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl glass px-5 py-3 shadow-soft">
      <div className="flex items-center justify-between">
        <ProvvyBrandMark href="/" />
        <nav className="hidden items-center gap-1 md:flex">
          {LANDING_NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Toggle dark mode"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a
            href="/auth/login"
            className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-foreground sm:inline-flex"
          >
            Log In
          </a>
          <a
            href={CALENDLY_CONSULTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-border bg-transparent px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            <Calendar className="h-3.5 w-3.5" />
            Book a Consultation
          </a>
          <a
            href="#compare"
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-transform hover:scale-[1.02]"
          >
            Compare routes <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 md:hidden">
          {LANDING_NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <div className="my-2 h-px bg-border" />
          <a
            href="/auth/login"
            className="rounded-lg px-3 py-2 text-[14px] font-medium text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
          >
            Log In
          </a>
          <a
            href={CALENDLY_CONSULTATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Calendar className="h-4 w-4" />
            Book a Consultation
          </a>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  return (
    <section id="compare" className="relative px-6 pt-6 pb-4 sm:pt-8 sm:pb-5">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <div className="relative mx-auto max-w-5xl text-center animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
          Provvy payment intelligence
        </p>
        <h1 className="mt-2 text-balance text-[1.85rem] font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
          <span className="text-gradient">Payment infrastructure changes every day.</span>
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-balance text-[15px] text-ink-soft sm:text-base">
          Provvy helps you understand what changed — and what it means for your business.
        </p>
      </div>

      <div className="relative mx-auto mt-4 max-w-6xl animate-fade-up">
        <LandingPaymentIntelligence />
      </div>

      <div className="relative mx-auto mt-3 max-w-5xl animate-fade-up">
        <LandingPaymentSearch />
      </div>

      <div className="relative mx-auto mt-4 max-w-5xl animate-fade-up">
        <LandingPaymentIntelligenceSubscribe />
      </div>
    </section>
  );
}

function ContextReveal() {
  return (
    <section id="commercial-os" className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            The layer above the payment
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Accounting records what happened.
            <br />
            <span className="text-gradient">Provvy coordinates what&apos;s happening now.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] text-ink-soft">
            Stripe can provide a rail. Xero can record the entry. Provvy sits above that
            infrastructure: it uses your commercial context to recommend what should happen
            next, then coordinates the work you approve.
          </p>
        </div>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {PRODUCT_LAYERS.map((layer) => (
            <div
              key={layer.title}
              className="rounded-2xl border border-border/60 bg-card p-5 text-left shadow-soft"
            >
              <div className="text-[16px] font-semibold tracking-tight">{layer.title}</div>
              <p className="mt-2 text-[14px] text-ink-soft">{layer.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowLibrary() {
  return (
    <section id="workflow-library" className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            After the route is chosen
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Provvy coordinates what follows.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Collecting, paying, sharing revenue, reconciling — the work around the payment, once
            you have authorised the path. Preview the workflows; deploy the ones that are ready
            in your workspace.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LANDING_WORKFLOWS.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <div
                key={workflow.slug}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gradient-purple group-hover:text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="text-[15px] font-semibold tracking-tight">{workflow.name}</div>
                </div>
                <div className="mt-5 flex-1 text-[14px] leading-relaxed text-ink-soft">
                  <div className="text-[11px] uppercase tracking-wider text-foreground/60">
                    What follows
                  </div>
                  <div className="mt-1.5 text-foreground/90">{workflow.outcome}</div>
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {workflow.saved}
                  </div>
                  <Link
                    href={COMMERCIAL_OS_ROUTES.publicWorkflowDetail(workflow.slug)}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-primary"
                  >
                    Preview Workflow <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">Pricing</div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Start with 30 days of Professional.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Tell Provvy what you&apos;re trying to do, then start working. No credit card required.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_CATALOG_ORDER.map((planId) => {
            const plan = PLAN_CATALOG[planId];
            const featured = planId === 'professional';
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-3xl border p-6 shadow-card ${
                  featured ? 'border-primary/30 bg-card' : 'border-border/60 bg-card'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[15px] font-semibold">{plan.name}</div>
                  {featured ? (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                      30-day trial
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 text-[28px] font-semibold tracking-tight">{plan.price}</div>
                <p className="mt-2 text-[13px] text-ink-soft">{plan.positioning}</p>
                <ul className="mt-5 flex-1 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px]">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={COMMERCIAL_OS_ROUTES.assessment}
                  className={`mt-6 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-medium transition-colors ${
                    featured
                      ? 'bg-gradient-purple text-primary-foreground shadow-glow'
                      : 'border border-border bg-background hover:bg-accent'
                  }`}
                >
                  {planId === 'enterprise' ? 'Talk to us' : 'Start with Provvy'}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Labs() {
  return (
    <section id="labs" className="px-6 pb-16 sm:pb-20">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-border/60 bg-card p-10 shadow-card sm:p-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
            <Beaker className="h-3.5 w-3.5" /> Provvy Labs
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Need help implementing the operating layer?
          </h2>
          <p className="mt-6 max-w-2xl text-[16px] text-ink-soft">
            Provvy Labs helps teams put the commercial context in place so Provvy can
            recommend and coordinate — while you keep authority over money.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/labs"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
            >
              Explore Provvy Labs <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={CALENDLY_CONSULTATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Calendar className="h-4 w-4" />
              Book a Consultation
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS: Record<string, string> = {
  Explore: '#compare',
  'How it works': '#how-it-works',
  Workflows: '#workflow-library',
  Recommendations: '#ai-advisor',
  Pricing: '#pricing',
  'Provvy Labs': '/labs',
  Contact: CALENDLY_CONSULTATION_URL,
  Privacy: PROVVYPAY_PRIVACY_PATH,
  Terms: PROVVYPAY_TERMS_PATH,
};

function Footer() {
  const cols = [
    { h: 'Product', l: ['Explore', 'How it works', 'Workflows', 'Recommendations'] },
    { h: 'Company', l: ['Provvy Labs', 'Contact', 'Pricing'] },
    { h: 'Legal', l: ['Privacy', 'Terms'] },
  ];
  return (
    <footer className="border-t border-border/60 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div>
            <ProvvyBrandMark href="/" />
            <p className="mt-4 max-w-xs text-[13px] text-ink-soft">
              Every payment has a best route. Provvy finds it — then coordinates what you
              authorise.
            </p>
          </div>
          {cols.map((column) => (
            <div key={column.h}>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
                {column.h}
              </div>
              <ul className="mt-4 space-y-2">
                {column.l.map((item) => (
                  <li key={item}>
                    <a
                      href={FOOTER_LINKS[item] ?? COMMERCIAL_OS_ROUTES.assessment}
                      className="text-[13px] text-ink-soft transition-colors hover:text-foreground"
                      {...(FOOTER_LINKS[item]?.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-border/60 pt-6 text-[12px] text-ink-soft">
          © {new Date().getFullYear()} Provvy. You stay in the driver&apos;s seat.
        </div>
      </div>
    </footer>
  );
}
