'use client';

import '@/components/journey/lovable/lovable-journey.css';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  FilePlus2,
  LayoutGrid,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Star,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

type CardId = 'create-invoice' | 'manage-invoices' | 'sync-xero' | 'collections' | 'workspace';

const CARDS: {
  id: CardId;
  title: string;
  desc: string;
  icon: typeof FilePlus2;
  to: string;
}[] = [
  {
    id: 'create-invoice',
    title: 'Create Invoice',
    desc: 'Create an invoice or payment link and accept fiat or crypto payments.',
    icon: FilePlus2,
    to: COMMERCIAL_OS_ROUTES.createInvoice,
  },
  {
    id: 'manage-invoices',
    title: 'Manage Invoices',
    desc: 'View paid, pending and overdue invoices and follow up outstanding payments.',
    icon: ReceiptText,
    to: COMMERCIAL_OS_ROUTES.receivables,
  },
  {
    id: 'sync-xero',
    title: 'Sync with Xero',
    desc: 'Push invoices and payments into Xero and reconcile automatically.',
    icon: RefreshCw,
    to: COMMERCIAL_OS_ROUTES.connected,
  },
  {
    id: 'collections',
    title: 'Collections & Revenue',
    desc: 'Monitor revenue, cash flow, payment performance and collections.',
    icon: BarChart3,
    to: COMMERCIAL_OS_ROUTES.timeline,
  },
  {
    id: 'workspace',
    title: 'Commercial Workspace',
    desc: 'Open your full commercial operating system with all workflows.',
    icon: LayoutGrid,
    to: COMMERCIAL_OS_ROUTES.workflows,
  },
];

const RECOMMENDATION: Record<string, { card: CardId; label: string; rationale: string }> = {
  reconcile: {
    card: 'create-invoice',
    label: 'Create Invoice',
    rationale:
      'allowing Provvy to automatically reconcile incoming payments and sync them with your ledger',
  },
  'revenue-share': {
    card: 'create-invoice',
    label: 'Create Agreement',
    rationale: 'so revenue splits are calculated, settled and distributed without manual work',
  },
  forecast: {
    card: 'collections',
    label: 'Cashflow Dashboard',
    rationale: 'so you can see committed inflows and outflows before they land',
  },
  'reduce-admin': {
    card: 'manage-invoices',
    label: 'AI Automations',
    rationale: 'so follow-ups, chasing and bookkeeping run themselves',
  },
  'paid-faster': {
    card: 'create-invoice',
    label: 'Payment Links',
    rationale: 'so customers can pay the moment they receive the invoice',
  },
  reporting: {
    card: 'collections',
    label: 'Collections & Revenue',
    rationale: 'so commercial performance is visible without building reports',
  },
  other: {
    card: 'create-invoice',
    label: 'Create Invoice',
    rationale: 'the fastest way to see Provvy execute an end-to-end commercial loop',
  },
};

type Business = {
  industry?: string;
  accounting?: string;
  challenge?: string;
  systems?: string[];
};

export function WorkspaceStartScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<CardId | null>(null);
  const [objective, setObjective] = useState('reconcile');
  const [business, setBusiness] = useState<Business>({});
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    try {
      const o = sessionStorage.getItem('provvy.objective');
      if (o) setObjective(o);
      const b = sessionStorage.getItem('provvy.business');
      if (b) setBusiness(JSON.parse(b) as Business);
    } catch {
      /* ignore sessionStorage errors */
    }
  }, []);

  const CHECKS = [
    'Business profile created',
    'Commercial workflows configured',
    'Accounting software detected',
    'Integrations mapped',
    'Workspace ready',
  ];

  useEffect(() => {
    if (revealed >= CHECKS.length) return;
    const t = setTimeout(() => setRevealed((r) => r + 1), 320);
    return () => clearTimeout(t);
  }, [revealed, CHECKS.length]);

  const rec = RECOMMENDATION[objective] ?? RECOMMENDATION.reconcile;

  const detected = useMemo(() => {
    const systems = business.systems?.length ? business.systems : ['Stripe'];
    const accounting =
      business.accounting && business.accounting !== 'None / Spreadsheets'
        ? business.accounting
        : 'Xero';
    return {
      industry: business.industry || 'Professional services',
      accounting,
      systems,
      challenge: business.challenge || 'Manual reconciliation',
    };
  }, [business]);

  const integrationLine = useMemo(() => {
    const all = [...detected.systems, detected.accounting];
    const list =
      all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}` : all[0];
    return `We've detected ${list} in your workflow. Your first workspace will be preconfigured to accept and reconcile payments across these channels.`;
  }, [detected]);

  const launch = (card: (typeof CARDS)[number]) => {
    setSelected(card.id);
    try {
      sessionStorage.setItem('provvy.startWorkflow', card.id);
    } catch {
      /* ignore */
    }
    setTimeout(() => router.push(card.to), 480);
  };

  return (
    <section className="relative px-6 pt-14 pb-24 animate-fade-up">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1.5 text-[12px] text-ink-soft shadow-soft">
            <Check className="h-3.5 w-3.5 text-primary" />
            Configuration complete
          </div>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Where would you like to start?
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            We&apos;ve configured your commercial operating system based on your business. Choose the
            workflow you&apos;d like to begin with today.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {CARDS.map((c, i) => {
              const Icon = c.icon;
              const isRec = c.id === rec.card;
              const isSelected = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => launch(c)}
                  aria-label={`Start with ${c.title}`}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className={`group relative overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-card transition-all animate-fade-up hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30'
                      : isRec
                        ? 'border-primary/40'
                        : 'border-border'
                  } ${c.id === 'workspace' ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`grid h-10 w-10 place-items-center rounded-xl ${
                        isRec
                          ? 'bg-gradient-purple text-primary-foreground shadow-glow'
                          : 'bg-accent text-accent-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {isSelected ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground animate-fade-up">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : isRec ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        <Star className="h-3 w-3" />
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                    {c.title}
                  </div>
                  <div className="mt-1 text-[13px] text-ink-soft">{c.desc}</div>
                  <div className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
                    {isSelected ? 'Opening' : 'Start here'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-6 text-[12.5px] text-ink-soft">
            This only decides which workspace opens first — every workflow stays available inside
            Provvy.
          </p>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-[14px] font-semibold tracking-tight">Provvy AI</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live
              </span>
            </div>

            <ul className="mt-5 space-y-2">
              {CHECKS.map((label, i) => (
                <li
                  key={label}
                  className={`flex items-center gap-2.5 text-[13px] transition-all duration-300 ${
                    i < revealed ? 'opacity-100' : 'translate-y-1 opacity-0'
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-foreground">{label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-accent p-4">
              <div className="text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
                AI Recommendation
              </div>
              <div className="mt-2 text-[13px] text-ink-soft">Based on your assessment we detected:</div>
              <ul className="mt-2 space-y-1 text-[13px] text-foreground">
                <li>• {detected.industry} business</li>
                <li>• {detected.accounting} accounting</li>
                <li>• {detected.systems.join(', ')} connected</li>
                <li>• {detected.challenge} as your biggest challenge</li>
              </ul>
              <div className="mt-3 text-[13px] leading-relaxed text-foreground">
                We recommend starting with{' '}
                <span className="font-semibold text-primary">{rec.label}</span>, {rec.rationale}.
              </div>
              <div className="mt-3 text-[12.5px] leading-relaxed text-ink-soft">{integrationLine}</div>

              <div className="mt-4 rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-soft">
                  Expected impact
                </div>
                <ul className="mt-2 space-y-1 text-[12.5px] text-foreground">
                  <li>• Faster invoice-to-cash</li>
                  <li>• Reduced reconciliation time</li>
                  <li>• Automated bookkeeping</li>
                </ul>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
