'use client';

import './lovable-journey.css';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import { GuestInvoiceCreator } from '@/components/journey/lovable/guest-invoice-creator';
import { AssessmentProvvyIdentity } from '@/components/journey/lovable/assessment-provvy-identity';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { JOURNEY_ROUTES } from '@/lib/journey/hackathon-journey';
import {
  persistJourneyBusiness,
  persistJourneyObjective,
} from '@/lib/journey/journey-assessment-storage.client';
import { PROVVYPAY_PRIVACY_PATH, PROVVYPAY_TERMS_PATH } from '@/lib/legal/provvypay-legal-paths';
import {
  INVOICE_LANDING_BUSINESSES,
  INVOICE_LANDING_COMPARISON,
  INVOICE_LANDING_COPY,
  INVOICE_LANDING_CREATOR_HREF,
  INVOICE_LANDING_EXAMPLE_INSIGHTS,
  INVOICE_LANDING_FAQS,
  INVOICE_LANDING_FINAL,
  INVOICE_LANDING_HOW_IT_WORKS,
  INVOICE_LANDING_HOW_IT_WORKS_HREF,
  INVOICE_LANDING_INTELLIGENCE,
  INVOICE_LANDING_OBJECTIVE,
  INVOICE_LANDING_OFFER_LINE,
  INVOICE_LANDING_PAYMENT_FLOW,
  INVOICE_LANDING_PAYMENT_ROUTES,
  INVOICE_LANDING_PRIMARY_CTA_LABEL,
  INVOICE_LANDING_SECONDARY_CTA_LABEL,
  INVOICE_LANDING_SITE_NAV,
  INVOICE_LANDING_TRIAL,
  INVOICE_LANDING_TRIAL_CTA_HREF,
  INVOICE_LANDING_TRIAL_CTA_LABEL,
  INVOICE_LANDING_TRIAL_OFFER_LINE,
  INVOICE_LANDING_WORKFLOWS,
  INVOICE_LANDING_XERO,
  invoiceLandingBusinesses,
  invoiceLandingWorkflows,
} from '@/lib/journey/invoice-acquisition-landing';

function startInvoiceTrial() {
  persistJourneyObjective(INVOICE_LANDING_OBJECTIVE);
}

function startXeroTrial() {
  persistJourneyObjective(INVOICE_LANDING_OBJECTIVE);
  persistJourneyBusiness({ accounting: 'Xero' });
}

function TrialCta({
  className,
  children = INVOICE_LANDING_TRIAL_CTA_LABEL,
}: {
  className: string;
  children?: string;
}) {
  return (
    <Link href={INVOICE_LANDING_TRIAL_CTA_HREF} onClick={startInvoiceTrial} className={className}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

function CreateInvoiceCta({
  className,
  children = INVOICE_LANDING_PRIMARY_CTA_LABEL,
}: {
  className: string;
  children?: string;
}) {
  return (
    <a href={INVOICE_LANDING_CREATOR_HREF} className={className}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

export function InvoiceAcquisitionPage() {
  const { dark, toggle } = useProvvyTheme();

  return (
    <div
      className={`lovable-journey min-h-screen overflow-x-hidden bg-background text-foreground antialiased ${dark ? 'dark' : ''}`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <SiteNav dark={dark} onToggleDark={toggle} />
        <Hero />
        <HowItWorks />
        <Creator />
        <Comparison />
        <PaymentFlow />
        <Accounting />
        <IntelligencePayoff />
        <ExampleIntelligence />
        <Workflows />
        <BusinessProof />
        <Trial />
        <Faq />
        <FinalCta />
        <Footer />
      </div>
    </div>
  );
}

function SiteNav({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl glass px-5 py-3 shadow-soft">
      <div className="flex items-center justify-between">
        <ProvvyBrandMark href="/" />
        <nav className="hidden items-center gap-1 md:flex">
          {INVOICE_LANDING_SITE_NAV.map((item) => (
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
          <CreateInvoiceCta className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-transform hover:scale-[1.02]" />
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
          {INVOICE_LANDING_SITE_NAV.map((item) => (
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
    <section className="relative px-6 pt-10 pb-8 sm:pt-14 sm:pb-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'var(--gradient-hero)' }}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
          {INVOICE_LANDING_COPY.eyebrow}
        </p>
        <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.035em] sm:text-5xl md:text-6xl">
          {INVOICE_LANDING_COPY.headline}
          <span className="mt-2 block text-foreground/90">{INVOICE_LANDING_COPY.headlineAccent}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-relaxed text-ink-soft sm:text-[17px]">
          {INVOICE_LANDING_COPY.heroSupporting}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CreateInvoiceCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto" />
          <a
            href={INVOICE_LANDING_HOW_IT_WORKS_HREF}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
          >
            {INVOICE_LANDING_SECONDARY_CTA_LABEL}
          </a>
        </div>
        <p className="mt-4 text-[13px] text-ink-soft">{INVOICE_LANDING_OFFER_LINE}</p>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 px-6 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {INVOICE_LANDING_HOW_IT_WORKS.headline}
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {INVOICE_LANDING_HOW_IT_WORKS.steps.map((step) => (
            <li key={step.n} className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {step.n}
              </p>
              <h3 className="mt-3 text-[16px] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Creator() {
  return (
    <section className="px-6 py-8 sm:py-10" aria-label="Create an invoice">
      <div className="mx-auto max-w-6xl">
        <GuestInvoiceCreator onStartTrial={startInvoiceTrial} />
      </div>
    </section>
  );
}

function Comparison() {
  const { free, professional } = INVOICE_LANDING_COMPARISON;
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_COMPARISON.headline}
        </h2>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="flex flex-col rounded-3xl border border-border/60 bg-card p-6 shadow-card">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              {free.title}
            </p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight">{free.price}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {free.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <CreateInvoiceCta className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-[14px] font-medium hover:bg-accent">
              {free.cta}
            </CreateInvoiceCta>
          </article>
          <article className="flex flex-col rounded-3xl border border-primary/30 bg-card p-6 shadow-glow">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-primary">
              {professional.title}
            </p>
            <p className="mt-3 text-[28px] font-semibold tracking-tight">{professional.price}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {professional.items.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <TrialCta className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-4 py-3 text-[14px] font-medium text-primary-foreground shadow-glow">
              {professional.cta}
            </TrialCta>
          </article>
        </div>
      </div>
    </section>
  );
}

function PaymentFlow() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_PAYMENT_FLOW.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_PAYMENT_FLOW.body}
        </p>
        <ol className="mt-8 space-y-3">
          {INVOICE_LANDING_PAYMENT_FLOW.stages.map((stage, index) => (
            <li key={stage.label}>
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                  {stage.label}
                </p>
                <p className="mt-2 text-[16px] font-semibold tracking-tight">{stage.value}</p>
                {stage.note ? (
                  <p className="mt-1 text-[12px] text-ink-soft">{stage.note}</p>
                ) : null}
              </div>
              {index < INVOICE_LANDING_PAYMENT_FLOW.stages.length - 1 ? (
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-ink-soft">
          Supported collection rails: {INVOICE_LANDING_PAYMENT_ROUTES.join(', ')}.
        </p>
        <TrialCta className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow">
          {INVOICE_LANDING_PAYMENT_FLOW.cta}
        </TrialCta>
      </div>
    </section>
  );
}

function Accounting() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_XERO.headline}
        </h2>
        <p className="mt-3 text-[20px] font-medium tracking-tight">{INVOICE_LANDING_XERO.subhead}</p>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_XERO.body}
        </p>
        <Link
          href={INVOICE_LANDING_TRIAL_CTA_HREF}
          onClick={startXeroTrial}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium hover:bg-accent"
        >
          {INVOICE_LANDING_XERO.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function IntelligencePayoff() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_INTELLIGENCE.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_INTELLIGENCE.body}
        </p>
        <ol className="mt-8 space-y-3">
          {INVOICE_LANDING_INTELLIGENCE.steps.map((step, index) => (
            <li key={step.label}>
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  {step.label}
                </p>
                <p className="mt-2 text-[16px] font-semibold tracking-tight">{step.question}</p>
              </div>
              {index < INVOICE_LANDING_INTELLIGENCE.steps.length - 1 ? (
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
          <AssessmentProvvyIdentity supportingLine="After systems are connected" />
          <p className="mt-3 text-[15px] font-semibold tracking-tight">
            {INVOICE_LANDING_INTELLIGENCE.advisorLine}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {INVOICE_LANDING_INTELLIGENCE.note}
          </p>
        </div>
      </div>
    </section>
  );
}

function ExampleIntelligence() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
          {INVOICE_LANDING_EXAMPLE_INSIGHTS.eyebrow}
        </p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_EXAMPLE_INSIGHTS.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_EXAMPLE_INSIGHTS.note}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {INVOICE_LANDING_EXAMPLE_INSIGHTS.items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
            >
              <h3 className="text-[15px] font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Workflows() {
  const items = invoiceLandingWorkflows();
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_WORKFLOWS.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_WORKFLOWS.body}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.slug}
              href={item.href}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft transition-colors hover:border-primary/30"
            >
              <h3 className="text-[15px] font-semibold tracking-tight">{item.name}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{item.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BusinessProof() {
  const items = invoiceLandingBusinesses();
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_BUSINESSES.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_BUSINESSES.body}
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.business}>
              {item.href ? (
                <Link
                  href={item.href}
                  aria-label={`${item.business}: ${item.workflow}`}
                  className="block h-full rounded-2xl border border-border/60 bg-card p-5 shadow-soft hover:border-primary/30"
                >
                  <p className="text-[14px] font-semibold">{item.business}</p>
                  <p className="mt-1 text-[12px] font-medium text-primary">{item.workflow}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{item.description}</p>
                </Link>
              ) : (
                <div className="h-full rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
                  <p className="text-[14px] font-semibold">{item.business}</p>
                  <p className="mt-1 text-[12px] font-medium text-primary">{item.workflow}</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{item.description}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trial() {
  return (
    <section className="px-6 py-6" aria-label="Professional trial">
      <div className="mx-auto max-w-4xl rounded-3xl border border-primary/30 bg-card p-8 shadow-glow sm:p-12">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_TRIAL.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_TRIAL.body}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-accent-foreground">
            {INVOICE_LANDING_TRIAL.daysLabel}
          </span>
          <span className="text-[14px] font-semibold">{INVOICE_LANDING_TRIAL.planLabel}</span>
        </div>
        <p className="mt-2 text-[13px] text-ink-soft">{INVOICE_LANDING_TRIAL_OFFER_LINE}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <TrialCta className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow" />
          <CreateInvoiceCta className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium hover:bg-accent">
            {INVOICE_LANDING_TRIAL.secondaryLabel}
          </CreateInvoiceCta>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Invoice questions
        </h2>
        <dl className="mt-8 space-y-6">
          {INVOICE_LANDING_FAQS.map((item) => (
            <div key={item.question} className="border-b border-border/60 pb-6">
              <dt>
                <h3 className="text-[16px] font-semibold tracking-tight">{item.question}</h3>
              </dt>
              <dd className="mt-2 text-[14px] leading-relaxed text-ink-soft">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 pb-16 pt-6 sm:pb-20">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {INVOICE_LANDING_FINAL.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          {INVOICE_LANDING_FINAL.body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <CreateInvoiceCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto" />
          <TrialCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent sm:w-auto" />
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS: Record<string, string> = {
  Explore: `${JOURNEY_ROUTES.landing}#compare`,
  'How it works': `${JOURNEY_ROUTES.landing}#how-it-works`,
  Workflows: `${JOURNEY_ROUTES.landing}#workflow-library`,
  Invoices: INVOICE_LANDING_CREATOR_HREF,
  Pricing: `${JOURNEY_ROUTES.landing}#pricing`,
  'Provvy Labs': '/labs',
  Contact: CALENDLY_CONSULTATION_URL,
  Privacy: PROVVYPAY_PRIVACY_PATH,
  Terms: PROVVYPAY_TERMS_PATH,
};

function Footer() {
  const cols = [
    { h: 'Product', l: ['Explore', 'How it works', 'Workflows', 'Invoices'] },
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
