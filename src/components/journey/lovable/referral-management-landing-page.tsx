'use client';

import './lovable-journey.css';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Calendar,
  Check,
  Link2,
  Menu,
  Moon,
  Percent,
  Share2,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';
import { useProvvyTheme } from '@/hooks/use-provvy-theme';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { JOURNEY_ROUTES } from '@/lib/journey/hackathon-journey';
import { persistJourneyObjective } from '@/lib/journey/journey-assessment-storage.client';
import { PROVVYPAY_PRIVACY_PATH, PROVVYPAY_TERMS_PATH } from '@/lib/legal/provvypay-legal-paths';
import {
  REFERRAL_LANDING_AGREEMENT,
  REFERRAL_LANDING_AUDIENCES,
  REFERRAL_LANDING_BUSINESSES,
  REFERRAL_LANDING_COMPARISON,
  REFERRAL_LANDING_COMPARE_HREF,
  REFERRAL_LANDING_COPY,
  REFERRAL_LANDING_EXAMPLE_PROGRAM,
  REFERRAL_LANDING_EXPLORE_HREF,
  REFERRAL_LANDING_FAQS,
  REFERRAL_LANDING_FEATURES,
  REFERRAL_LANDING_FINAL,
  REFERRAL_LANDING_HOW_IT_WORKS_HREF,
  REFERRAL_LANDING_OFFER,
  REFERRAL_LANDING_OFFER_LINE,
  REFERRAL_LANDING_PAYOUT,
  REFERRAL_LANDING_PAYOUT_ROUTES,
  REFERRAL_LANDING_SECONDARY_CTA_LABEL,
  REFERRAL_LANDING_SITE_NAV,
  REFERRAL_LANDING_SPREADSHEET,
  REFERRAL_LANDING_TRIAL_CTA_HREF,
  REFERRAL_LANDING_TRIAL_CTA_LABEL,
  REFERRAL_LANDING_WORKFLOW,
  referralLandingBusinesses,
} from '@/lib/journey/referral-management-landing';

const FEATURE_ICONS = [Link2, Users, Share2, Percent, Check, Wallet] as const;

function startReferralTrial() {
  persistJourneyObjective('revenue-share');
}

function TrialCta({
  className,
  children = REFERRAL_LANDING_TRIAL_CTA_LABEL,
}: {
  className: string;
  children?: string;
}) {
  return (
    <Link href={REFERRAL_LANDING_TRIAL_CTA_HREF} onClick={startReferralTrial} className={className}>
      {children} <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}

export function ReferralManagementLandingPage() {
  const { dark, toggle } = useProvvyTheme();

  return (
    <div
      className={`lovable-journey min-h-screen overflow-x-hidden bg-background text-foreground antialiased ${dark ? 'dark' : ''}`}
    >
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <SiteNav dark={dark} onToggleDark={toggle} />
        <Hero />
        <ProductVisual />
        <Workflow />
        <OfferStrip />
        <SpreadsheetProblem />
        <Features />
        <AgreementObligation />
        <PaymentCoordination />
        <BusinessWorkflows />
        <Audiences />
        <WhyProvvy />
        <OfferSection />
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
          {REFERRAL_LANDING_SITE_NAV.map((item) => (
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
            href={REFERRAL_LANDING_COMPARE_HREF}
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
          {REFERRAL_LANDING_SITE_NAV.map((item) => (
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
      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <p className="mb-4 text-[12px] font-medium uppercase tracking-[0.2em] text-ink-soft">
          {REFERRAL_LANDING_COPY.eyebrow}
        </p>
        <h1 className="text-balance text-[1.85rem] font-semibold tracking-[-0.03em] sm:text-4xl md:text-5xl">
          {REFERRAL_LANDING_COPY.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-soft sm:text-[17px]">
          {REFERRAL_LANDING_COPY.supporting}
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_COPY.audience}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          <TrialCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto" />
          <a
            href={REFERRAL_LANDING_HOW_IT_WORKS_HREF}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
          >
            {REFERRAL_LANDING_SECONDARY_CTA_LABEL}
          </a>
        </div>
        <p className="mt-4 text-[13px] font-medium text-ink-soft">{REFERRAL_LANDING_OFFER_LINE}</p>
      </div>
    </section>
  );
}

function ProductVisual() {
  const example = REFERRAL_LANDING_EXAMPLE_PROGRAM;
  return (
    <section className="px-6 pb-10 sm:pb-12" aria-labelledby="referral-product-visual-heading">
      <div className="mx-auto max-w-3xl animate-fade-up">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                {example.eyebrow}
              </p>
              <p className="mt-1 text-[12px] uppercase tracking-wide text-ink-soft">
                {example.programLabel}
              </p>
              <h2
                id="referral-product-visual-heading"
                className="mt-0.5 text-[18px] font-semibold tracking-tight"
              >
                {example.programName}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
              <Share2 className="h-3 w-3" aria-hidden="true" />
              Referral Management
            </span>
          </div>
          <dl className="grid gap-px bg-border/60 sm:grid-cols-2">
            {example.fields.map((field) => (
              <div key={field.label} className="bg-card px-5 py-3.5 sm:px-6">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                  {field.label}
                </dt>
                <dd className="mt-1 break-all text-[14px] font-semibold tracking-tight">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-border/60 px-5 py-4 sm:px-6">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary">
              {example.manageLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_WORKFLOW.headline}
        </h2>
        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {REFERRAL_LANDING_WORKFLOW.steps.map((step) => (
            <li
              key={step.n}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
            >
              <p className="text-[12px] font-semibold tabular-nums text-primary">{step.n}</p>
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function OfferStrip() {
  return (
    <section className="px-6 py-6" aria-label="Professional trial">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 rounded-2xl border border-primary/30 bg-card px-5 py-5 shadow-soft sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="text-[15px] font-semibold tracking-tight">{REFERRAL_LANDING_OFFER.headline}</p>
          <p className="mt-1 text-[13px] text-ink-soft">{REFERRAL_LANDING_OFFER_LINE}</p>
        </div>
        <TrialCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-5 py-3 text-[14px] font-medium text-primary-foreground shadow-glow sm:w-auto" />
      </div>
    </section>
  );
}

function FlowColumn({
  title,
  steps,
}: {
  title: string;
  steps: readonly string[];
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">{title}</p>
      <ol className="mt-4 space-y-0">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col items-start">
            <div className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] font-medium">
              {step}
            </div>
            {index < steps.length - 1 ? (
              <ArrowDown className="my-1.5 ml-3 h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SpreadsheetProblem() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_SPREADSHEET.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_SPREADSHEET.body}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <FlowColumn title="Before" steps={REFERRAL_LANDING_SPREADSHEET.before} />
          <FlowColumn title="After" steps={REFERRAL_LANDING_SPREADSHEET.after} />
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_FEATURES.headline}
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REFERRAL_LANDING_FEATURES.items.map((item, index) => {
            const Icon = FEATURE_ICONS[index] ?? Check;
            return (
              <li
                key={item.title}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{item.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function AgreementObligation() {
  const copy = REFERRAL_LANDING_AGREEMENT;
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {copy.headline}
        </h2>
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Agreement / conversation
            </p>
            <p className="mt-3 text-[15px] leading-relaxed">“{copy.conversation}”</p>
          </div>
          <div className="flex justify-center">
            <ArrowDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          </div>
          <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-glow">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {copy.structuresLabel}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {copy.fields.map((field) => (
                <div key={field.label}>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                    {field.label}
                  </dt>
                  <dd className="mt-0.5 text-[14px] font-semibold">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex justify-center">
            <ArrowDown className="h-4 w-4 text-ink-soft" aria-hidden="true" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: copy.customerPaysLabel, value: copy.customerPaysValue },
              { label: copy.commissionLabel, value: copy.commissionValue },
              { label: copy.payableLabel, value: copy.payableValue },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                  {item.label}
                </p>
                <p className="mt-2 text-[15px] font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-ink-soft">{copy.note}</p>
        </div>
      </div>
    </section>
  );
}

function PaymentCoordination() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_PAYOUT.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_PAYOUT.body}
        </p>
        <div className="mt-8 rounded-3xl border border-border/60 bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[16px] font-semibold">{REFERRAL_LANDING_PAYOUT.partner}</p>
              <p className="mt-1 text-[13px] text-ink-soft">{REFERRAL_LANDING_PAYOUT.corridor}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">
                {REFERRAL_LANDING_PAYOUT.amountLabel}
              </p>
              <p className="mt-1 text-[18px] font-semibold">{REFERRAL_LANDING_PAYOUT.amountValue}</p>
            </div>
          </div>
          <p className="mt-5 text-[11px] font-medium uppercase tracking-wide text-ink-soft">
            {REFERRAL_LANDING_PAYOUT.routesLabel}
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {REFERRAL_LANDING_PAYOUT_ROUTES.map((route) => (
              <li
                key={route}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-[12px] font-medium"
              >
                {route}
              </li>
            ))}
          </ul>
          <Link
            href={REFERRAL_LANDING_COMPARE_HREF}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-primary"
          >
            {REFERRAL_LANDING_PAYOUT.ctaLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_PAYOUT.message}
        </p>
      </div>
    </section>
  );
}

function BusinessWorkflows() {
  const items = referralLandingBusinesses();
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_BUSINESSES.headline}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_BUSINESSES.body}
        </p>
        <div className="relative mt-8">
          <ul
            className="landing-business-flows-scroller flex gap-3 overflow-x-auto overscroll-x-contain pb-1 max-md:snap-x max-md:snap-mandatory max-md:pr-8 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:pb-0 md:pr-0"
            aria-label="Business workflow examples"
          >
            {items.map((item) => {
              const content = (
                <>
                  <p className="text-[15px] font-semibold tracking-tight">{item.business}</p>
                  <p className="mt-1 text-[13px] font-medium text-primary">{item.workflow}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{item.description}</p>
                </>
              );
              const className =
                'block h-full min-h-[2.75rem] rounded-2xl border border-border/60 bg-card p-5 shadow-soft outline-none transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/20 max-md:min-w-[min(16.5rem,78%)] max-md:snap-start';
              return (
                <li key={item.business} className="md:min-w-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className={className}
                      aria-label={`${item.business}: ${item.workflow}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className={className}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 md:hidden"
            style={{ background: 'linear-gradient(to left, var(--background), transparent)' }}
          />
        </div>
      </div>
    </section>
  );
}

function Audiences() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_AUDIENCES.headline}
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {REFERRAL_LANDING_AUDIENCES.items.map((item) => (
            <li
              key={item.title}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft"
            >
              <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">
                {item.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WhyProvvy() {
  return (
    <section className="px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_COMPARISON.headline}
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              {REFERRAL_LANDING_COMPARISON.traditionalTitle}
            </p>
            <ul className="mt-4 space-y-2">
              {REFERRAL_LANDING_COMPARISON.traditional.map((item) => (
                <li key={item} className="text-[14px] text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-card p-5 shadow-glow sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              {REFERRAL_LANDING_COMPARISON.provvyTitle}
            </p>
            <ul className="mt-4 space-y-2">
              {REFERRAL_LANDING_COMPARISON.provvy.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[14px]">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferSection() {
  return (
    <section id="trial" className="scroll-mt-24 px-6 py-10 sm:py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-primary/30 bg-card p-8 shadow-card sm:p-12">
        <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-ink-soft">
          {REFERRAL_LANDING_OFFER.daysLabel}
        </p>
        <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          {REFERRAL_LANDING_OFFER.headline}
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_OFFER.body}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
            {REFERRAL_LANDING_OFFER.planLabel}
          </span>
          <span className="rounded-full border border-border px-3 py-1 text-[12px] font-medium">
            {REFERRAL_LANDING_OFFER.included}
          </span>
        </div>
        <TrialCta className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto" />
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section className="px-6 py-10 sm:py-12" aria-labelledby="referral-faq-heading">
      <div className="mx-auto max-w-3xl">
        <h2
          id="referral-faq-heading"
          className="text-balance text-3xl font-semibold tracking-[-0.02em] sm:text-4xl"
        >
          Referral management questions
        </h2>
        <dl className="mt-8 space-y-6">
          {REFERRAL_LANDING_FAQS.map((item) => (
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
          {REFERRAL_LANDING_FINAL.headline}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          {REFERRAL_LANDING_FINAL.body}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <TrialCta className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] sm:w-auto" />
          <a
            href={REFERRAL_LANDING_EXPLORE_HREF}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent sm:w-auto"
          >
            {REFERRAL_LANDING_FINAL.secondaryLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

const FOOTER_LINKS: Record<string, string> = {
  Explore: `${JOURNEY_ROUTES.landing}#compare`,
  'How it works': `${JOURNEY_ROUTES.landing}#how-it-works`,
  Workflows: `${JOURNEY_ROUTES.landing}#workflow-library`,
  Recommendations: `${JOURNEY_ROUTES.landing}#how-it-works`,
  Pricing: `${JOURNEY_ROUTES.landing}#pricing`,
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
