'use client';

/**
 * Agreement Intelligence Briefing — Commercial Commitments layout
 *
 * This page tells a commercial story, not a technical status report.
 * Every section answers a question an operator actually cares about.
 *
 * Layout (top → bottom):
 *   1. AgreementExecutiveSummary   — name, stage, 3 facts, one-sentence status
 *   2. CommercialSummaryCards      — 4 fixed cards: Participants / Payments / Revenue / Settlement
 *   3. CommercialBlockers          — deduplicated blockers (hidden when none)
 *   4. CommercialTimeline          — canonical history of this commercial relationship
 *   5. BriefingParticipantsSection — participant commitments (hidden when no participants)
 *   6. <details> Advanced details  — health, obligations, approvals, terms, settlement, funnel, journey
 *
 * The Commercial Timeline is a first-class section.
 * It shows commercial milestones — not system events or audit log entries.
 *
 * Removed from main view (now in Advanced details or deleted):
 *   - BriefingRecommendedActionHero     (WorkflowHeader in shell already answers this)
 *   - AgreementIntelligenceFeedbackPrompt (noise)
 *   - BriefingSectionNav                (12-link nav no longer needed)
 *   - BriefingAgreementHealth           (→ Advanced details)
 *   - BriefingFundingFunnel             (→ Advanced details)
 *   - BriefingSettlementBlockersPanel   (replaced by CommercialBlockers)
 *   - BriefingSummarySection            (replaced by AgreementExecutiveSummary)
 *   - BriefingAuditSection              (duplicate of CommercialTimeline — removed)
 *   - BriefingIntelligencePanel sidebar (was duplicating hero + blockers + AI metrics)
 *   - BriefingCommercialJourney sidebar (→ Advanced details)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useOperationalAuditStore } from '@/hooks/use-operational-audit-store';
import { deriveConversationImportAuditTimeline } from '@/lib/operations/audit/conversation-import-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
import {
  buildCommercialTimeline,
} from '@/lib/commercial/commercial-timeline-events';
import {
  CommercialTimeline as CanonicalCommercialTimeline,
} from '@/components/commercial/commercial-timeline';
import { deriveAgreementIntelligence } from '@/lib/agreements/intelligence/agreement-intelligence-engine';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import {
  emptyOperationalGraphFunding,
  emptyOperationalGraphSummary,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { ProjectOperationalLoadingState } from '@/components/projects/project-operational-loading-state';
import { BriefingAgreementHealth } from '@/components/agreements/health/briefing-agreement-health';
import {
  BriefingApprovalsSection,
  BriefingCommercialTermsSection,
  BriefingObligationsSection,
  BriefingParticipantsSection,
  BriefingSettlementSection,
} from '@/components/agreements/briefing/briefing-sections';
import { BriefingFundingFunnel } from '@/components/agreements/briefing/briefing-funding-funnel';
import { useAgreementIntelligenceTracking } from '@/hooks/use-agreement-intelligence-tracking';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { CommercialJourney } from '@/components/workflow/commercial-journey';
import { useCommercialBrain } from '@/components/workflow/commercial-brain-context';
import type { WorkflowStage } from '@/components/workflow/workflow-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  AgreementIntelligenceOutput,
  AgreementSettlementBlocker,
} from '@/lib/agreements/intelligence/agreement-intelligence.types';
import type { AgreementBriefingSnapshot } from '@/lib/agreements/agreement-briefing.model';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability';
import {
  projectParticipantsPath,
} from '@/lib/projects/project-routes';
import { cn } from '@/lib/utils';

/* ─── Stage pill labels (commercial language) ──────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  'setup':                'Setting up',
  'configuring':          'Configuring earnings',
  'collecting-approvals': 'Collecting approvals',
  'preparing-payments':   'Setting up payments',
  'ready-to-collect':     'Ready to collect',
  'collecting-revenue':   'Collecting revenue',
  'ready-to-release':     'Releasing payments',
  'operational':          'Operational',
};

/* ─── 1. Executive summary ──────────────────────────────────────────────────
 *
 * Answers within 5 seconds:
 *   What is this? · What is happening? · What are the key facts?
 *
 * Does NOT repeat the mission or CTA — WorkflowHeader (shell) handles those.
 */

type AgreementExecutiveSummaryProps = {
  snapshot: AgreementBriefingSnapshot;
  /** Workflow stage slug (e.g. 'collecting-approvals') — matches STAGE_LABELS keys exactly. */
  currentStage: WorkflowStage | null;
  guidanceHeadline: string | null;
};

function AgreementExecutiveSummary({
  snapshot,
  currentStage,
  guidanceHeadline,
}: AgreementExecutiveSummaryProps) {
  const stageLabel = currentStage ? (STAGE_LABELS[currentStage] ?? currentStage) : null;

  return (
    <div className="rounded-xl border border-border/60 bg-card px-5 py-4 space-y-3">
      {/* Identity row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {snapshot.agreementName}
          </h1>
          {snapshot.agreementType ? (
            <p className="text-sm text-muted-foreground mt-0.5">{snapshot.agreementType}</p>
          ) : null}
        </div>
        {stageLabel ? (
          <Badge variant="outline" className="shrink-0 text-xs font-medium">
            {stageLabel}
          </Badge>
        ) : null}
      </div>

      {/* Three key facts */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 py-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Participants</span>
          <span className="text-sm font-semibold tabular-nums">{snapshot.participantCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Obligations</span>
          <span className="text-sm font-semibold tabular-nums">{snapshot.obligationCount}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Settlement readiness</span>
          <span className="text-sm font-semibold tabular-nums">
            {snapshot.settlementReadinessScore}%
          </span>
        </div>
        {snapshot.agreementValue ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Agreement value</span>
            <span className="text-sm font-semibold">{snapshot.agreementValue}</span>
          </div>
        ) : null}
      </div>

      {/* One-sentence status */}
      {guidanceHeadline ? (
        <p className="text-sm text-muted-foreground leading-relaxed border-t border-border/30 pt-3">
          {guidanceHeadline}
        </p>
      ) : null}
    </div>
  );
}

/* ─── 2. Commercial summary cards ──────────────────────────────────────────── */

type CommercialSummaryCardsProps = {
  snapshot: AgreementBriefingSnapshot;
  projectId: string;
  paymentProviderConnected: boolean;
  revenueFlowing: boolean;
};

function CommercialSummaryCards({
  snapshot,
  projectId,
  paymentProviderConnected,
  revenueFlowing,
}: CommercialSummaryCardsProps) {
  const participantsApproved =
    snapshot.participantCount > 0 &&
    snapshot.pendingApprovalCount === 0;

  const settlementGreen =
    snapshot.settlementReadinessScore >= 80 && snapshot.blockingIssues.length === 0;

  const cards: {
    icon: React.ReactNode;
    title: string;
    state: string;
    detail: string;
    cta?: { label: string; href: string };
    accent?: 'green' | 'amber' | 'default';
  }[] = [
    {
      icon: <Users className="h-4 w-4" />,
      title: 'Participants',
      state:
        snapshot.participantCount === 0
          ? 'None added'
          : participantsApproved
            ? `${snapshot.participantCount} approved`
            : `${snapshot.pendingApprovalCount} of ${snapshot.participantCount} pending`,
      detail:
        snapshot.participantCount === 0
          ? 'Add team members so agreements can be generated.'
          : participantsApproved
            ? 'All participants have approved.'
            : 'Approvals are required before payments can begin.',
      cta: { label: 'Manage team', href: projectParticipantsPath(projectId) },
      accent:
        snapshot.participantCount === 0
          ? 'default'
          : participantsApproved
            ? 'green'
            : 'amber',
    },
    {
      icon: <CreditCard className="h-4 w-4" />,
      title: 'Payments',
      state: paymentProviderConnected ? 'Connected' : 'Not connected',
      detail: paymentProviderConnected
        ? 'Customers can make payments.'
        : 'Connect a payment provider so customers can begin paying.',
      cta: paymentProviderConnected
        ? undefined
        : { label: 'Connect payment provider', href: '/dashboard/settings/merchant#payment-provider' },
      accent: paymentProviderConnected ? 'green' : 'amber',
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      title: 'Revenue',
      state: revenueFlowing ? 'Flowing' : 'Not started',
      detail: revenueFlowing
        ? 'Revenue is being collected against this agreement.'
        : 'Revenue will begin once payments are enabled and participants approve.',
      accent: revenueFlowing ? 'green' : 'default',
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      title: 'Settlement',
      state: settlementGreen
        ? 'Ready'
        : snapshot.settlementReadinessScore > 0
          ? `${snapshot.settlementReadinessScore}% ready`
          : 'Not ready',
      detail: settlementGreen
        ? 'All requirements are met. Settlement can proceed.'
        : snapshot.blockingIssues.length > 0
          ? `${snapshot.blockingIssues.length} issue${snapshot.blockingIssues.length === 1 ? '' : 's'} blocking settlement.`
          : 'Complete approvals and connect payments to enable settlement.',
      accent: settlementGreen ? 'green' : snapshot.settlementReadinessScore > 50 ? 'default' : 'amber',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.title}
          className={cn(
            'rounded-xl border px-4 py-3.5 space-y-2',
            card.accent === 'green' &&
              'border-[rgba(29,111,66,0.25)] bg-[rgba(29,111,66,0.03)]',
            card.accent === 'amber' && 'border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20',
            card.accent === 'default' && 'border-border/60 bg-card'
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full',
                card.accent === 'green' && 'bg-[rgba(29,111,66,0.1)] text-[rgb(29,111,66)]',
                card.accent === 'amber' && 'bg-amber-100/80 text-amber-700',
                card.accent === 'default' && 'bg-muted text-muted-foreground'
              )}
            >
              {card.icon}
            </div>
            <span
              className={cn(
                'text-xs font-semibold',
                card.accent === 'green' && 'text-[rgb(29,111,66)]',
                card.accent === 'amber' && 'text-amber-700 dark:text-amber-400',
                card.accent === 'default' && 'text-muted-foreground'
              )}
            >
              {card.state}
            </span>
          </div>
          <p className="text-xs font-semibold text-foreground">{card.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{card.detail}</p>
          {card.cta ? (
            <Button asChild variant="outline" size="sm" className="h-6 text-xs px-2.5 w-full mt-1">
              <Link href={card.cta.href}>
                {card.cta.label}
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ─── 3. Commercial blockers ───────────────────────────────────────────────── */

type CommercialBlockersProps = {
  blockers: AgreementSettlementBlocker[];
  snapshot: AgreementBriefingSnapshot;
};

function CommercialBlockers({ blockers, snapshot }: CommercialBlockersProps) {
  // Merge operational blockers with snapshot blocking issues, deduplicate by label
  const operationalBlockers = blockers.filter((b) => b.severity === 'blocking');
  const snapshotBlockers = snapshot.blockingIssues.filter(
    (bi) => !operationalBlockers.some((ob) => ob.label === bi.label)
  );

  const hasBlockers = operationalBlockers.length > 0 || snapshotBlockers.length > 0;
  if (!hasBlockers) return null;

  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20 px-5 py-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        Current blockers
      </p>
      <ul className="space-y-3">
        {operationalBlockers.map((blocker) => (
          <li key={blocker.id} className="space-y-1.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground leading-snug">{blocker.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{blocker.resolution}</p>
                {blocker.ctaHref && blocker.ctaLabel ? (
                  <Button asChild variant="outline" size="sm" className="h-6 text-xs px-2.5 mt-1">
                    <Link href={blocker.ctaHref}>{blocker.ctaLabel}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
        {snapshotBlockers.map((bi) => (
          <li key={bi.label} className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-snug">{bi.label}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── 4. Commercial Timeline ────────────────────────────────────────────────
 *
 * First-class section showing the canonical commercial history of this relationship.
 * Events are commercial milestones — not system log entries.
 *
 * Uses buildCommercialTimeline() to convert audit entries to commercial language.
 */

type BriefingCommercialTimelineProps = {
  auditEntries: ReturnType<typeof mergeAuditTimeline>;
  projectId: string;
};

function BriefingCommercialTimeline({ auditEntries, projectId }: BriefingCommercialTimelineProps) {
  const events = React.useMemo(
    () => buildCommercialTimeline({ auditEntries, projectId }),
    [auditEntries, projectId]
  );

  if (events.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/10 px-5 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Commercial Timeline
      </p>
      <CanonicalCommercialTimeline
        events={events}
        maxItems={20}
        showImpact
      />
    </div>
  );
}

/* ─── 6. Advanced details (progressive disclosure) ─────────────────────────
 *
 * Hidden by default. Contains:
 *   - Agreement Health (AI score)
 *   - Coordination Progress funnel
 *   - Settlement details + funding sources
 *   - Commercial terms
 *   - Obligations
 *   - Approvals
 *   - Commercial journey
 */

type AdvancedDetailsProps = {
  intelligence: AgreementIntelligenceOutput;
  projectId: string;
  currency: string;
  releaseConfidence: ReleaseConfidenceSnapshot;
  onTreasuryChange: () => void;
};

function AdvancedDetails({
  intelligence,
  projectId,
  currency,
  releaseConfidence,
  onTreasuryChange,
}: AdvancedDetailsProps) {
  const [open, setOpen] = React.useState(false);
  const { workflowCtx } = useCommercialBrain();

  return (
    <div className="rounded-xl border border-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-muted-foreground">Advanced details</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open ? (
        <div className="border-t border-border/40 px-0 py-0 space-y-0">
          <div className="space-y-6 p-5">
            <BriefingAgreementHealth health={intelligence.health} />
            <BriefingFundingFunnel steps={intelligence.fundingFunnel} />
            <BriefingSettlementSection
              snapshot={intelligence.snapshot}
              projectId={projectId}
              currency={currency}
              releaseConfidence={releaseConfidence}
              onTreasuryChange={onTreasuryChange}
            />
            <BriefingCommercialTermsSection
              snapshot={intelligence.snapshot}
              projectId={projectId}
            />
            <BriefingObligationsSection
              snapshot={intelligence.snapshot}
              projectId={projectId}
            />
            {intelligence.snapshot.approvals.length > 0 ? (
              <BriefingApprovalsSection snapshot={intelligence.snapshot} />
            ) : null}
            {workflowCtx ? (
              <CommercialJourney
                currentStage={workflowCtx.currentStage}
                variant="vertical"
                className="border rounded-lg p-4 bg-white/50"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────────────────── */

type AgreementIntelligenceBriefingProps = {
  projectId: string;
};

export function AgreementIntelligenceBriefing({ projectId }: AgreementIntelligenceBriefingProps) {
  const {
    summary,
    deal,
    refresh,
    projectParticipants,
    loading,
    notFound,
    sectionErrors,
    invalidate,
  } = useProjectWorkspace();

  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [obligationRows, setObligationRows] = React.useState<BriefingObligationRowInput[]>([]);
  const [obligationsLoading, setObligationsLoading] = React.useState(true);

  const {
    guidance,
    graph,
    workspaceContext,
    kpis,
    releaseBlockers,
  } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    treasury,
    scopeTitle: summary?.name,
    enabled: Boolean(deal),
    traceSurface: 'agreement-intelligence-briefing',
  });

  const { commercialCapabilities, workflowCtx: workflowContext } = useCommercialBrain();

  const storeEntries = useOperationalAuditStore({ projectId });

  const auditEntries = React.useMemo(() => {
    if (!deal) return storeEntries;
    const fromDeal = deriveConversationImportAuditTimeline([deal], projectId);
    return mergeAuditTimeline(storeEntries, fromDeal);
  }, [deal, projectId, storeEntries]);

  const loadTreasuryAndObligations = React.useCallback(async () => {
    if (!deal) return;
    setObligationsLoading(true);
    try {
      const [treRes, oblRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}/treasury-summary`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch(`/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(deal.id)}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);
      if (treRes.ok) {
        const json = (await treRes.json()) as { data: ProjectTreasurySummary };
        setTreasury(json.data ?? null);
      }
      if (oblRes.ok) {
        const json = (await oblRes.json()) as { data: BriefingObligationRowInput[] };
        setObligationRows(
          Array.isArray(json.data) ? json.data.filter((r) => r.deal_id === deal.id) : []
        );
      } else {
        setObligationRows([]);
      }
    } catch {
      setObligationRows([]);
    } finally {
      setObligationsLoading(false);
    }
  }, [deal, projectId]);

  React.useEffect(() => {
    void loadTreasuryAndObligations();
  }, [loadTreasuryAndObligations]);

  const intelligence = React.useMemo(() => {
    if (!summary || !deal) return null;

    const coordinationGraph = graph ?? {
      participants: [],
      obligations: [],
      summary: emptyOperationalGraphSummary(),
      funding: emptyOperationalGraphFunding(),
    };

    return deriveAgreementIntelligence({
      projectId,
      deal,
      summary,
      participants: projectParticipants,
      obligationRows,
      treasury,
      kpis,
      graph: coordinationGraph,
      guidance,
      releaseBlockers,
      workspaceContext,
    });
  }, [
    deal,
    graph,
    guidance,
    kpis,
    obligationRows,
    projectId,
    projectParticipants,
    releaseBlockers,
    summary,
    treasury,
    workspaceContext,
  ]);

  const { markRecommendationActed } = useAgreementIntelligenceTracking({
    projectId,
    agreementName: summary?.name ?? '',
    intelligence,
    enabled: Boolean(intelligence),
  });

  // Keep markRecommendationActed in scope (analytics — not exposed in new UI)
  void markRecommendationActed;

  if (loading && !summary) {
    return <ProjectOperationalLoadingState variant="loading" />;
  }

  if (notFound) {
    return (
      <ProjectOperationalLoadingState
        variant="error"
        message="This agreement could not be found. It may still be syncing from onboarding."
      />
    );
  }

  if (!summary || !deal || !intelligence) {
    return (
      <ProjectOperationalLoadingState
        variant="configuring"
        message="This agreement is still being configured."
        onRetry={() => {
          invalidate('all');
          void refresh({ scope: 'all', force: true });
        }}
      />
    );
  }

  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: treasury?.currency ?? deal.projectValueCurrency,
    workspaceDefaultCurrency: workspaceContext.defaultCurrency,
  });

  const handleTreasuryChange = () => {
    notifyWorkspaceActivationRefresh();
    void loadTreasuryAndObligations();
    void refresh({ scope: 'all', silent: true, force: true });
  };

  // Derive commercial-language facts for summary cards
  const paymentProviderConnected = commercialCapabilities?.paymentProviderConnected ?? false;
  const revenueFlowing = commercialCapabilities?.revenueFlowing ?? false;

  // Guidance headline (one sentence status)
  const guidanceHeadline =
    guidance.explanation.explainability.headline ?? null;

  // Stage slug from workflow context — used directly as STAGE_LABELS key.
  // currentStage ('collecting-approvals') matches the STAGE_LABELS record exactly.
  const currentStage = workflowContext?.currentStage ?? null;

  const hasParticipants = intelligence.snapshot.participantCount > 0;

  return (
    <div className="space-y-4">
      {sectionErrors.participants ? (
        <p className="text-sm text-amber-700/90 dark:text-amber-400/90 px-1">
          Participant data is temporarily unavailable. Other sections remain available.
        </p>
      ) : null}

      {/* 1. Executive summary — name, stage, 3 facts, one-sentence status */}
      <AgreementExecutiveSummary
        snapshot={intelligence.snapshot}
        currentStage={currentStage}
        guidanceHeadline={guidanceHeadline}
      />

      {/* 2. Four commercial summary cards */}
      <CommercialSummaryCards
        snapshot={intelligence.snapshot}
        projectId={projectId}
        paymentProviderConnected={paymentProviderConnected}
        revenueFlowing={revenueFlowing}
      />

      {/* 3. Current blockers — only shown when blockers exist */}
      <CommercialBlockers
        blockers={intelligence.settlementBlockers}
        snapshot={intelligence.snapshot}
      />

      {/* 4. Commercial Timeline — canonical history of this commercial relationship */}
      <BriefingCommercialTimeline auditEntries={auditEntries} projectId={projectId} />

      {/* 5. Participant commitments — only shown when participants exist */}
      {hasParticipants ? (
        <BriefingParticipantsSection
          snapshot={intelligence.snapshot}
          projectId={projectId}
          participantActions={intelligence.participantActions}
          agreementName={summary.name}
        />
      ) : null}

      {/* 6. Advanced details (collapsed by default) */}
      <AdvancedDetails
        intelligence={intelligence}
        projectId={projectId}
        currency={currency}
        releaseConfidence={guidance.releaseConfidence}
        onTreasuryChange={handleTreasuryChange}
      />

      {obligationsLoading ? (
        <p className="text-xs text-muted-foreground text-center pb-2">
          Refreshing obligation data…
        </p>
      ) : null}
    </div>
  );
}
