'use client';

import '@/components/journey/lovable/lovable-journey.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Brain,
  Briefcase,
  Check,
  FilePlus2,
  LayoutGrid,
  ReceiptText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useEntitlements } from '@/hooks/use-entitlements';
import { buildInstalledWorkspaceActions } from '@/lib/journey/installed-workflow-workspace-actions';
import { getWorkflowBySlug } from '@/lib/journey/workflow-library-catalog';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import { useCommercialReadinessOptional } from '@/hooks/use-commercial-readiness';
import { WorkspaceAdvisorPanel } from '@/components/journey/lovable/workspace-advisor-panel';
import {
  hasJourneyAssessmentData,
  parseJourneyAssessmentContext,
  persistJourneyBusiness,
  persistJourneyObjective,
  restoreJourneyAssessment,
  type JourneyAssessmentSnapshot,
} from '@/lib/journey/journey-assessment-storage.client';
import { snapshotFromOnboardingPayload } from '@/lib/journey/workspace-advisor-intro';
import {
  buildWorkspaceRecommendationState,
  deriveWorkspaceRecommendation,
} from '@/lib/journey/workspace-recommendation';

type CardId =
  | 'create-invoice'
  | 'manage-invoices'
  | 'sync-xero'
  | 'collections'
  | 'workspace'
  | 'arrangements';

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
    desc: 'Create an invoice now. Add payment methods when you are ready so customers can pay.',
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
    id: 'arrangements',
    title: 'Commercial Workspaces',
    desc: 'Open operational workspaces created from agreements, onboarding, or manually.',
    icon: Briefcase,
    to: COMMERCIAL_OS_ROUTES.arrangements,
  },
  {
    id: 'workspace',
    title: 'Operating dashboard',
    desc: 'Open your organization dashboard to work through invoices, workflows and items that need attention.',
    icon: LayoutGrid,
    to: COMMERCIAL_OS_ROUTES.commercialWorkspace,
  },
  {
    id: 'collections',
    title: 'Collections & Revenue',
    desc: 'Monitor revenue, cash flow, payment performance and collections.',
    icon: BarChart3,
    to: COMMERCIAL_OS_ROUTES.timeline,
  },
  {
    id: 'sync-xero',
    title: 'Sync with Accounting',
    desc: 'Connect accounting when you are ready to push invoices and payments into your books.',
    icon: RefreshCw,
    to: COMMERCIAL_OS_ROUTES.connected,
  },
];

export function WorkspaceStartScreen() {
  const router = useRouter();
  const readiness = useCommercialReadinessOptional();
  const { entitlements } = useEntitlements();
  const { workflows, loading: workflowsLoading } = useDeployedWorkflows();
  const activeProfessionalTrial =
    entitlements?.hasActiveFirstPartyTrial === true ||
    (entitlements?.status === 'trialing' && entitlements.trialExpired !== true);
  const [selected, setSelected] = useState<string | null>(null);
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

  const deployedWorkflowSlugs = useMemo(
    () => workflows.map((workflow) => workflow.templateSlug),
    [workflows]
  );

  const recommendation = useMemo(
    () =>
      deriveWorkspaceRecommendation({
        snapshot,
        workspace: buildWorkspaceRecommendationState({
          xeroConnected: readiness?.connection.connected === true,
          deployedWorkflowSlugs,
          readinessKnown: Boolean(readiness && !readiness.loading),
          merchantRails: readiness?.merchantRails,
        }),
      }),
    [snapshot, readiness, deployedWorkflowSlugs]
  );

  const installedWorkflowCards = useMemo(
    () => buildInstalledWorkspaceActions(workflows),
    [workflows]
  );

  const launch = (card: { id: string; to: string }) => {
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
            Your workspace is ready
          </div>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Where would you like to start?
          </h1>
          <p className="mt-3 max-w-xl text-lg text-ink-soft">
            Create or manage invoices whenever you are ready. Connecting accounting, payment rails or
            other systems is optional.
          </p>
          <p className="mt-3 text-[13px] text-ink-soft">
            {activeProfessionalTrial ? 'You are on an active Professional trial. ' : null}
            <Link href={COMMERCIAL_OS_ROUTES.planBilling} className="font-medium text-primary hover:underline">
              Plan &amp; Billing
            </Link>{' '}
            is where you can check your current plan, trial status and upgrade options.
          </p>

          <div className="mt-10">
            <h2 className="text-[13px] font-semibold tracking-tight text-foreground">Start working</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              Core workflows you can begin immediately.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CARDS.map((c, i) => {
                const Icon = c.icon;
                const isSelected = selected === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => launch(c)}
                    aria-label={`Start with ${c.title}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className={`group relative overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-card transition-all animate-fade-up hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      {isSelected ? (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground animate-fade-up">
                          <Check className="h-3.5 w-3.5" />
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
          </div>

          {recommendation ? (
            <div className="mt-10">
              <h2 className="text-[13px] font-semibold tracking-tight text-foreground">
                Recommended for you
              </h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                Optional — based on what you told us during setup.
              </p>
              <button
                type="button"
                onClick={() =>
                  launch({ id: `recommendation-${recommendation.kind}`, to: recommendation.destination })
                }
                aria-label={recommendation.title}
                className="group relative mt-4 w-full overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-purple text-primary-foreground shadow-glow">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                    Optional
                  </span>
                </div>
                <div className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
                  {recommendation.title}
                </div>
                <div className="mt-1 text-[13px] text-ink-soft">{recommendation.description}</div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-primary opacity-80 transition-opacity group-hover:opacity-100">
                  {selected === `recommendation-${recommendation.kind}`
                    ? 'Opening'
                    : recommendation.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            </div>
          ) : null}
        </div>

        <WorkspaceAdvisorPanel
          snapshot={snapshot}
          deployedWorkflowSlugs={deployedWorkflowSlugs}
        />
      </div>
    </section>
  );
}
