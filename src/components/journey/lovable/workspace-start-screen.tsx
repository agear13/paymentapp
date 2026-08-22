'use client';

import '@/components/journey/lovable/lovable-journey.css';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Check,
  FilePlus2,
  LayoutGrid,
  ReceiptText,
  RefreshCw,
  Star,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { buildInstalledWorkspaceActions } from '@/lib/journey/installed-workflow-workspace-actions';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { WorkspaceAdvisorPanel } from '@/components/journey/lovable/workspace-advisor-panel';
import {
  hasJourneyAssessmentData,
  parseJourneyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
  restoreJourneyAssessment,
  type JourneyAssessmentSnapshot,
} from '@/lib/journey/journey-assessment-storage.client';
import { snapshotFromOnboardingPayload, workspaceStartCardIdForObjective } from '@/lib/journey/workspace-advisor-intro';

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
    title: 'Sync with Accounting',
    desc: 'Push invoices and payments into your accounting software and reconcile automatically.',
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
    desc: 'Open your commercial operating dashboard with active workflows and items needing attention.',
    icon: LayoutGrid,
    to: COMMERCIAL_OS_ROUTES.commercialWorkspace,
  },
];

export function WorkspaceStartScreen() {
  const router = useRouter();
  const { workflows, loading: workflowsLoading } = useDeployedWorkflows();
  const [selected, setSelected] = useState<CardId | null>(null);
  const [snapshot, setSnapshot] = useState<JourneyAssessmentSnapshot>({
    objective: null,
    business: null,
  });

  useEffect(() => {
    const local = restoreJourneyAssessment();
    if (hasJourneyAssessmentData(local)) {
      setSnapshot(local);
      return;
    }

    let cancelled = false;
    void fetch('/api/onboarding', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { state?: { onboarding_context?: string; workspace_industry?: string } } | null) => {
        if (cancelled || !payload) return;
        const fromServer = snapshotFromOnboardingPayload(payload);
        if (!fromServer) return;
        const parsed = parseJourneyAssessmentContext(payload.state?.onboarding_context);
        if (parsed?.objective) persistJourneyObjective(parsed.objective);
        if (parsed?.business) persistJourneyBusiness(parsed.business);
        setSnapshot(fromServer);
      })
      .catch(() => {
        /* keep empty snapshot — do not invent assessment data */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recommendedCard = workspaceStartCardIdForObjective(snapshot.objective);

  const installedWorkflowCards = useMemo(
    () => buildInstalledWorkspaceActions(workflows),
    [workflows]
  );

  const launch = (card: { id: string; to: string }) => {
    setSelected(card.id as CardId);
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
              const isRec = Boolean(recommendedCard && c.id === recommendedCard);
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

            {!workflowsLoading &&
              installedWorkflowCards.map((action, index) => {
                const catalog = getWorkflowBySlug(action.slug);
                const Icon = catalog?.icon ?? Brain;
                const cardIndex = CARDS.length + index;
                return (
                  <button
                    key={action.slug}
                    type="button"
                    onClick={() => launch({ id: action.slug, to: action.href })}
                    aria-label={`Start with ${action.title}`}
                    style={{ animationDelay: `${cardIndex * 50}ms` }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all animate-fade-up hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                      {action.title}
                    </div>
                    <div className="mt-1 text-[13px] text-ink-soft">{action.description}</div>
                    <div className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
                      Start here
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

        <WorkspaceAdvisorPanel
          snapshot={snapshot}
          deployedWorkflowSlugs={workflows.map((workflow) => workflow.templateSlug)}
        />
      </div>
    </section>
  );
}
