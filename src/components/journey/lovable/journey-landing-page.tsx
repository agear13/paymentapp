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
  Brain,
  Calendar,
  Check,
  Clock,
  Menu,
  MessageSquare,
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

const LANDING_NAV = [
  { label: 'Explore', href: '#compare' },
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

const NARRATIVE_STEPS = [
  {
    title: 'See what is generally available',
    body: 'Explore a concrete payment and the tradeoffs between cost, speed and simplicity. Anyone can do this.',
  },
  {
    title: 'Connect the context that changes the answer',
    body: 'Cash, terms, rails, approvals and history determine what is actually optimal for this business.',
  },
  {
    title: 'Provvy recommends. You decide.',
    body: 'Provvy explains why. You authorise the next step. Provvy coordinates what you approved, and automates only what you permit.',
  },
] as const;

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

const CONTROL_PRINCIPLES = [
  'Provvy understands.',
  'Provvy recommends.',
  'Provvy explains why.',
  'You decide what to authorise.',
  'Provvy coordinates what you approved.',
] as const;

export function JourneyLandingPage() {
  const { dark, toggle } = useProvvyTheme();

  return (
    <LandingAdvisorProvider>
    <div
      className={`lovable-journey min-h-screen bg-background text-foreground overflow-x-hidden antialiased ${dark ? 'dark' : ''}`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <Nav dark={dark} onToggleDark={toggle} />
        <Hero />
        <HowItWorks />
        <AdvisorAndTimeline />
        <WorkflowLibrary />
        <ContextReveal />
        <Pricing />
        <Labs />
        <Footer />
      </div>
      <LandingAdvisor />
    </div>
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
    <section id="compare" className="relative px-6 pt-8 pb-6 sm:pt-12 sm:pb-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <h1 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl">
          <span className="text-gradient">What&apos;s the best way to move this money?</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-balance text-base text-ink-soft sm:text-lg">
          Compare payment routes. Then connect Provvy to find what&apos;s best for your business.
        </p>
      </div>

      <div className="relative mx-auto mt-5 max-w-5xl animate-fade-up">
        <LandingPaymentSearch />
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

function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">How it works</div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            From a useful first answer to a decision you still own.
          </h2>
        </div>
        <div className="grid gap-3">
          {NARRATIVE_STEPS.map((step, index) => (
            <div
              key={step.title}
              className="grid gap-4 rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:grid-cols-[72px_1fr] sm:items-start"
            >
              <div className="text-[13px] font-medium text-ink-soft">0{index + 1}</div>
              <div>
                <div className="text-[17px] font-semibold tracking-tight">{step.title}</div>
                <p className="mt-1.5 text-[14px] text-ink-soft">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <div className="text-[12px] uppercase tracking-[0.16em] text-ink-soft">
            You stay in control
          </div>
          <p className="mt-3 max-w-2xl text-[16px] text-foreground">
            Provvy never silently takes control of money. The progression is recommend → approve
            → automate, and you define the rules and permissions.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {CONTROL_PRINCIPLES.map((line) => (
              <li key={line} className="flex items-center gap-2 text-[14px]">
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
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

function AdvisorAndTimeline() {
  return (
    <section id="ai-advisor" className="px-6 py-10 sm:py-12">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            <MessageSquare className="h-3.5 w-3.5" /> After you connect
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            Recommendations for this transaction — grounded in your position.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Once Provvy can see invoices, agreements, cash and rails, it can recommend what
            should happen next and explain why. You decide whether to authorise it.
          </p>
          <div className="mt-6 space-y-2">
            {[
              'Should we collect this on card or wait for the bank run?',
              'What happens if this customer pays late?',
              'Which suppliers are tying up cash this week?',
            ].map((question) => (
              <div
                key={question}
                className="rounded-2xl border border-border/60 bg-background px-4 py-3 text-[14px]"
              >
                {question}
              </div>
            ))}
          </div>
        </div>
        <div id="timeline" className="rounded-3xl border border-border/60 bg-card p-6 shadow-card sm:p-8">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            <Brain className="h-3.5 w-3.5" /> What is happening now
          </div>
          <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
            A live commercial timeline, not a static ledger.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Invoices, payments, agreements, approvals and the work you authorised — in one stream
            so the next decision is made with the current position.
          </p>
          <div className="mt-6 divide-y divide-border/60 rounded-2xl border border-border/60 bg-background">
            {[
              'Invoice issued · awaiting the authorised collection route',
              'Supplier payment held for the next approved run',
              'Agreement terms extracted · approval still required',
              'Recommendation ready · waiting for you to authorise',
            ].map((event) => (
              <div key={event} className="px-4 py-3 text-[14px] text-foreground/90">
                {event}
              </div>
            ))}
          </div>
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
