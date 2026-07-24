'use client';

import { ProvvyBrandMark } from '@/components/journey/lovable/provvy-brand-mark';
import { LovableJourneyShell } from '@/components/journey/lovable/lovable-journey-shell';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Play,
  Sparkles,
  Receipt,
  FileText,
  Users,
  MessagesSquare,
  Briefcase,
  Mail,
  TrendingUp,
  Brain,
  CheckCircle2,
  ChevronRight,
  Layers,
  Coins,
  Split,
  ArrowUpRight,
  Check,
  Sparkle,
  Building2,
  CreditCard,
  FileSignature,
  Bell,
  Workflow,
  GraduationCap,
  Beaker,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Moon, Sun, Calendar, Menu, X } from "lucide-react";


export function JourneyLandingPage() {
  return (
    <LovableJourneyShell className="overflow-x-hidden antialiased">
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-60" />
      <div className="relative">
        <Nav />
        <Hero />
        <Problem />
        <Infrastructure />
        <WorkflowLibrary />
        <AIAdvisor />
        <BusinessTimeline />
        <Academy />
        <Labs />
        <FinalCTA />
        <Footer />
      </div>
    </div>
    </LovableJourneyShell>
  );
}

/* ---------------- NAV ---------------- */
function Nav() {
  const items = [
    "Commercial AI OS",
    "Workflow Library",
    "Solutions",
    "Provvy Labs",
    "Commercial Academy",
    "Pricing",
  ];
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefers;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  const CALENDLY_URL = "https://calendly.com/provvy/consultation";
  return (
    <header className="sticky top-4 z-50 mx-auto w-[min(1200px,calc(100%-2rem))] rounded-2xl glass px-5 py-3 shadow-soft">
      <div className="flex items-center justify-between">
        <ProvvyBrandMark href="/journey" />
        <nav className="hidden items-center gap-1 md:flex">
          {items.map((i) => (
            <a
              key={i}
              href="#"
              className="rounded-lg px-3 py-1.5 text-[13px] text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {i}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={toggle}
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
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-xl border border-border bg-transparent px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-accent sm:inline-flex"
          >
            <Calendar className="h-3.5 w-3.5" />
            Book a Consultation
          </a>
          <a
            href="/journey/assessment"
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-[13px] font-medium text-background transition-transform hover:scale-[1.02]"
          >
            Start Assessment <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-xl border border-border text-ink-soft transition-colors hover:bg-accent hover:text-foreground md:hidden"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 md:hidden">
          {items.map((i) => (
            <a
              key={i}
              href="#"
              className="rounded-lg px-3 py-2 text-[14px] text-ink-soft transition-colors hover:bg-accent hover:text-foreground"
            >
              {i}
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
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[14px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Calendar className="h-4 w-4" />
            Book a Consultation
          </a>
        </div>
      )}
    </header>
  );
}

/* ---------------- HERO ---------------- */
function Hero() {
  return (
    <section className="relative px-6 pt-24 pb-28">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px]"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Introducing the Commercial Operating System
        </div>
        <h1 className="text-balance text-5xl font-semibold tracking-[-0.03em] sm:text-6xl md:text-7xl">
          <span className="text-gradient">Your Commercial</span>
          <br />
          <span className="text-gradient">Operating System.</span>
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-lg text-ink-soft sm:text-xl">
          Connect your business. Understand how it operates. Deploy the right commercial workflow.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/journey/assessment"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Start Assessment
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
          <a
            href="#walkthrough"
            className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Play className="h-4 w-4" />
            Watch Interactive Walkthrough
          </a>
        </div>
        <p className="mt-6 text-[13px] text-ink-soft/70">
          Takes under two minutes · No credit card · One improvement at a time
        </p>
      </div>

      <div className="relative mx-auto mt-20 max-w-5xl animate-fade-up">
        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  return (
    <div className="rounded-3xl glass p-3 shadow-card">
      <div className="rounded-2xl bg-card p-6">
        <div className="flex items-center gap-2 pb-4">
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted" />
          <div className="ml-4 flex items-center gap-2 rounded-lg bg-secondary px-3 py-1 text-[12px] text-ink-soft">
            <Sparkle className="h-3 w-3 text-primary" /> Provvy Commercial OS · Live
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="rounded-xl border border-border/60 bg-background p-5">
            <div className="flex items-center gap-2 text-[13px] text-ink-soft">
              <Brain className="h-3.5 w-3.5 text-primary" /> Analysing your business
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Connected Xero", 100],
                ["Read 128 invoices", 100],
                ["Mapped 6 recurring workflows", 82],
                ["Detected 3 improvement areas", 54],
              ].map(([label, pct]) => (
                <div key={label as string} className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-foreground/80">{label}</span>
                    <span className="text-ink-soft">{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-purple"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background p-5">
            <div className="text-[12px] uppercase tracking-wider text-ink-soft">
              Recommendation
            </div>
            <div className="mt-2 text-[15px] font-medium">Autonomous Reconciliation</div>
            <div className="mt-3 space-y-1.5 text-[12px] text-ink-soft">
              <div className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Payment Links</div>
              <div className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Invoice Automation</div>
              <div className="flex items-center gap-1.5"><Check className="h-3 w-3 text-primary" /> Xero Sync</div>
            </div>
            <div className="mt-4 rounded-lg bg-accent px-3 py-2 text-[12px] text-accent-foreground">
              ~ 8 hours saved / month
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PROBLEM STATEMENT ---------------- */
function Problem() {
  const inputs = [
    { icon: FileText, label: "Accounting" },
    { icon: CreditCard, label: "Payments" },
    { icon: FileSignature, label: "Agreements" },
    { icon: MessagesSquare, label: "Conversations" },
    { icon: Briefcase, label: "Projects" },
    { icon: Mail, label: "Email" },
  ];
  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
          The Problem
        </div>
        <h2 className="text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-6xl">
          Businesses don't have a payments problem.
          <br />
          <span className="text-gradient">They have an operations problem.</span>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-[15px] text-ink-soft">
          The signals of how a business operates are scattered across accounting, payments,
          agreements, conversations, projects and email. Provvy AI unifies them into commercial
          understanding — and recommends the workflows that make the business run better.
        </p>
      </div>
      <div className="mx-auto mt-20 max-w-4xl">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {inputs.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-soft"
            >
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[14px] font-medium">{label}</span>
            </div>
          ))}
        </div>
        <Arrow />
        <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-4 text-[15px] font-medium text-primary-foreground shadow-glow">
          <Brain className="h-4 w-4" /> Provvy AI
        </div>
        <Arrow />
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center text-[14px] font-medium shadow-soft">
            Commercial Understanding
          </div>
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-center text-[14px] font-medium shadow-soft">
            Workflow Recommendations
          </div>
        </div>
        <Arrow />
        <div className="mx-auto max-w-md rounded-2xl bg-foreground p-5 text-center text-[15px] font-semibold text-background shadow-card">
          Commercial Operating System
        </div>
      </div>
    </section>
  );
}
function Arrow() {
  return (
    <div className="my-4 flex justify-center">
      <div className="h-10 w-px bg-gradient-to-b from-transparent via-primary/40 to-primary/60" />
    </div>
  );
}

/* ---------------- INFRASTRUCTURE ---------------- */
function Infrastructure() {
  const tools = [
    "Xero",
    "Stripe",
    "Pinch Payments",
    "Wise",
    "Google Workspace",
    "Slack",
    "Email",
    "WhatsApp",
  ];
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            Infrastructure
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Works with the tools you already use.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Provvy unifies your existing systems. It doesn't replace them.
          </p>
        </div>
        <div className="relative rounded-3xl glass p-10 shadow-card">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tools.map((t) => (
              <div
                key={t}
                className="flex items-center justify-center rounded-xl border border-border/60 bg-card px-4 py-4 text-[13px] font-medium shadow-soft"
              >
                {t}
              </div>
            ))}
          </div>
          <div className="my-8 flex justify-center">
            <div className="h-12 w-px bg-gradient-to-b from-transparent via-primary/40 to-primary/60" />
          </div>
          <div className="mx-auto flex max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-purple px-6 py-4 text-[15px] font-medium text-primary-foreground shadow-glow">
            <Brain className="h-4 w-4" /> Provvy AI
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- WORKFLOW LIBRARY ---------------- */
function WorkflowLibrary() {
  const workflows = [
    {
      icon: Receipt,
      name: "Autonomous Reconciliation",
      outcome: "Every payment matched to the right invoice, automatically.",
      saved: "~ 8 hours / month",
    },
    {
      icon: CreditCard,
      name: "Payment Collection",
      outcome: "Get paid faster with smart links, reminders and payment plans.",
      saved: "~ 12 days off DSO",
    },
    {
      icon: TrendingUp,
      name: "Cashflow Forecasting",
      outcome: "A live, 13-week view of cash grounded in your real business data.",
      saved: "~ 6 hours / month",
    },
    {
      icon: Split,
      name: "Revenue Sharing",
      outcome: "Automate splits, referrals and partner payouts on every transaction.",
      saved: "~ 4 hours / month",
    },
    {
      icon: Coins,
      name: "Supplier Payments",
      outcome: "Approve, batch and pay suppliers on the right cash cycle.",
      saved: "~ 5 hours / month",
    },
    {
      icon: Workflow,
      name: "Commercial Operations",
      outcome: "Route agreements, approvals and onboarding through one system.",
      saved: "~ 10 hours / month",
    },
  ];
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            Workflow Library
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Deployable business blueprints.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Not features. Not modules. Complete commercial workflows — designed, connected and
            deployed into your business.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map(({ icon: Icon, name, outcome, saved }) => (
            <div
              key={name}
              className="group flex flex-col rounded-2xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gradient-purple group-hover:text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-[15px] font-semibold tracking-tight">{name}</div>
              </div>
              <div className="mt-5 flex-1 text-[14px] leading-relaxed text-ink-soft">
                <div className="text-[11px] uppercase tracking-wider text-foreground/60">
                  Expected outcome
                </div>
                <div className="mt-1.5 text-foreground/90">{outcome}</div>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {saved}
                </div>
                <button className="inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                  Preview Workflow <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- AI ADVISOR ---------------- */
function AIAdvisor() {
  const questions = [
    "Can I afford another employee?",
    "Why is profit falling?",
    "What happens if this customer pays late?",
    "Which suppliers are slowing cash flow?",
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % questions.length), 3400);
    return () => clearInterval(t);
  }, [questions.length]);

  const answers: Record<number, { text: string; chips: string[] }> = {
    0: {
      text: "Based on current margin (32%), forecast runway (14 months) and recurring revenue growth (+9%/mo), you can support one additional A$72k hire from Q2 without eroding cash reserves.",
      chips: ["Margin 32%", "Runway 14mo", "MRR +9%"],
    },
    1: {
      text: "Two supplier price increases and a shift toward lower-margin projects account for 78% of the decline. Repricing three agreements would recover ~A$9.4k/month.",
      chips: ["Supplier +12%", "Mix shift", "-A$9.4k/mo"],
    },
    2: {
      text: "A 30-day delay would push you A$16k below your safety buffer in week 4. Two automated reminders and a payment plan would prevent it.",
      chips: ["Buffer risk", "Week 4", "Auto reminder"],
    },
    3: {
      text: "Three suppliers require payment 14 days ahead of your inflow cycle. Renegotiating terms with two would free ~A$27k of working capital.",
      chips: ["3 suppliers", "Terms 30→45", "+A$27k WC"],
    },
  };

  const a = answers[active];

  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            AI Advisor
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Ask commercial questions.
            <br />
            <span className="text-gradient">Get commercial answers.</span>
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Grounded in your accounting, invoices, agreements and cashflow — not the open web.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-2">
            {questions.map((q, i) => (
              <button
                key={q}
                onClick={() => setActive(i)}
                className={`w-full rounded-2xl border p-4 text-left text-[14px] transition-all ${
                  i === active
                    ? "border-primary/30 bg-accent shadow-soft"
                    : "border-border/60 bg-card hover:border-primary/20"
                }`}
              >
                <div className="flex items-center gap-2 text-ink-soft">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="text-[11px] uppercase tracking-wider">Question</span>
                </div>
                <div className="mt-1.5 font-medium text-foreground">{q}</div>
              </button>
            ))}
          </div>
          <div className="rounded-3xl glass p-6 shadow-card">
            <div className="flex items-center gap-2 text-[12px] uppercase tracking-wider text-ink-soft">
              <Brain className="h-3.5 w-3.5 text-primary" /> Provvy Advisor
            </div>
            <div key={active} className="mt-4 animate-fade-up text-[17px] leading-relaxed">
              {a.text}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {a.chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-border/60 bg-background px-3 py-1 text-[12px] text-foreground/80"
                >
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-border/60 bg-background p-4 text-[13px] text-ink-soft">
              Every answer traced back to the underlying invoice, agreement or cashflow record.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- LIVE COMMERCIAL TIMELINE ---------------- */
function BusinessTimeline() {
  const events = [
    { icon: Receipt, label: "Invoice #2041 created", meta: "A$4,200 · Acme Ltd", tone: "neutral" },
    { icon: CreditCard, label: "Customer paid", meta: "A$4,200 · Stripe", tone: "positive" },
    { icon: FileSignature, label: "Agreement signed", meta: "Northwind Ltd · Master Services", tone: "neutral" },
    { icon: Building2, label: "Supplier approved", meta: "Loom Studio · Net 30", tone: "neutral" },
    { icon: TrendingUp, label: "Forecast updated", meta: "Cash runway extended by 3 weeks", tone: "positive" },
    { icon: Sparkles, label: "AI recommendation", meta: "Auto-reconcile 12 pending invoices", tone: "accent" },
  ];
  const [visible, setVisible] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setVisible((v) => (v >= events.length ? 1 : v + 1)), 1100);
    return () => clearInterval(t);
  }, [events.length]);

  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            Live Commercial Timeline
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            <span className="text-gradient">Every commercial event,</span>
            <br />
            in one continuous stream.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Invoices, payments, agreements, suppliers, forecasts and AI recommendations — flowing
            into a single view of how your business is actually operating.
          </p>
        </div>
        <div className="rounded-3xl glass p-4 shadow-card">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3 text-[12px] text-ink-soft">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live
            </div>
            <div>Today</div>
          </div>
          <div className="divide-y divide-border/40">
            {events.slice(0, visible).map((e, i) => {
              const Icon = e.icon;
              return (
                <div key={i} className="flex animate-fade-up items-center gap-4 p-4">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl ${
                      e.tone === "positive"
                        ? "bg-primary/10 text-primary"
                        : e.tone === "accent"
                          ? "bg-gradient-purple text-primary-foreground"
                          : "bg-secondary text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-medium">{e.label}</div>
                    <div className="text-[12px] text-ink-soft">{e.meta}</div>
                  </div>
                  <Bell className="h-3.5 w-3.5 text-ink-soft/40" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- ACADEMY ---------------- */
function Academy() {
  const topics = [
    { icon: Coins, label: "Cash Flow" },
    { icon: TrendingUp, label: "Forecasting" },
    { icon: Receipt, label: "Accounting Automation" },
    { icon: Split, label: "Revenue Sharing" },
    { icon: Workflow, label: "Commercial Systems" },
    { icon: Brain, label: "AI Implementation" },
  ];
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em] text-ink-soft">
            <GraduationCap className="h-3.5 w-3.5" /> Commercial Academy
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Learn how modern businesses operate.
          </h2>
          <p className="mt-4 text-[15px] text-ink-soft">
            Practical resources for finance, ops and founders building the commercial layer of
            their business.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map(({ icon: Icon, label }) => (
            <a
              key={label}
              href="#"
              className="group relative flex flex-col justify-between rounded-3xl border border-border/60 bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary transition-colors group-hover:bg-gradient-purple group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-16">
                <div className="text-[11px] uppercase tracking-wider text-ink-soft">Course</div>
                <div className="mt-1 text-[18px] font-semibold tracking-tight">{label}</div>
                <div className="mt-4 inline-flex items-center gap-1 text-[13px] text-primary">
                  Explore <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- LABS ---------------- */
function Labs() {
  return (
    <section className="px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-border/60 bg-card p-10 shadow-card sm:p-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-accent-foreground">
            <Beaker className="h-3.5 w-3.5" /> Provvy Labs
          </div>
          <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
            Need help implementing your
            <br />
            <span className="text-gradient">Commercial Operating System?</span>
          </h2>
          <p className="mt-6 max-w-2xl text-[16px] text-ink-soft">
            Provvy Labs is our AI implementation team. We work directly with you to design,
            connect and deploy the commercial workflows that matter most.
          </p>
          <a
            href="https://calendly.com/provvy/consultation"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3.5 text-[15px] font-medium text-background transition-transform hover:scale-[1.02]"
          >
            <Calendar className="h-4 w-4" />
            Book a Consultation <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FINAL CTA ---------------- */
function FinalCTA() {
  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-purple p-[1px] shadow-glow">
          <div className="rounded-[calc(1.5rem-1px)] bg-card p-10 text-center sm:p-16">
            <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-purple shadow-glow">
              <CheckCircle2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-balance text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
              Ready to build your
              <br />
              <span className="text-gradient">Commercial Operating System?</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[15px] text-ink-soft">
              Start with a two-minute assessment. Provvy will connect your business, understand how
              it operates and recommend the first workflow to deploy.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/journey/assessment"
                className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-purple px-6 py-3.5 text-[15px] font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                Start Assessment
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="https://calendly.com/provvy/consultation"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Calendar className="h-4 w-4" />
                Book a Consultation
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- FOOTER ---------------- */
function Footer() {
  const cols = [
    { h: "Products", l: ["Commercial AI OS", "Workflow Library", "AI Advisor", "Live Timeline"] },
    { h: "Solutions", l: ["Cash Flow", "Payments", "Forecasting", "Operations"] },
    { h: "Resources", l: ["Commercial Academy", "Workflow Library", "Documentation"] },
    { h: "Company", l: ["Provvy Labs", "Contact", "Privacy"] },
  ];
  return (
    <footer className="mt-16 border-t border-border/60 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <ProvvyBrandMark href="/journey" />
              <span className="text-[15px] font-semibold tracking-tight">Provvy</span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] text-ink-soft">
              The AI Commercial Operating System.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <div className="text-[12px] font-semibold uppercase tracking-wider text-foreground">
                {c.h}
              </div>
              <ul className="mt-4 space-y-2">
                {c.l.map((i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="text-[13px] text-ink-soft transition-colors hover:text-foreground"
                    >
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 border-t border-border/60 pt-6 text-[12px] text-ink-soft">
          © {new Date().getFullYear()} Provvy. Designed around your business.
        </div>
      </div>
    </footer>
  );
}
