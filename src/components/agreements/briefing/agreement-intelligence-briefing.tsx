'use client';

import * as React from 'react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useOperationalAuditStore } from '@/hooks/use-operational-audit-store';
import { deriveConversationImportAuditTimeline } from '@/lib/operations/audit/conversation-import-audit';
import { mergeAuditTimeline } from '@/lib/operations/audit/operational-audit';
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
import { BriefingSectionNav } from '@/components/agreements/briefing/briefing-section-nav';
import { BriefingRecommendedActionHero } from '@/components/agreements/briefing/briefing-recommended-action-hero';
import { BriefingFundingFunnel } from '@/components/agreements/briefing/briefing-funding-funnel';
import { BriefingSettlementBlockersPanel } from '@/components/agreements/briefing/briefing-settlement-blockers-panel';
import { BriefingAgreementHealth } from '@/components/agreements/health/briefing-agreement-health';
import {
  BriefingActivitySection,
  BriefingApprovalsSection,
  BriefingAuditSection,
  BriefingCommercialTermsSection,
  BriefingIntelligencePanel,
  BriefingObligationsSection,
  BriefingParticipantsSection,
  BriefingSettlementSection,
  BriefingSummarySection,
} from '@/components/agreements/briefing/briefing-sections';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

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

  return (
    <div className="space-y-6">
      {sectionErrors.participants ? (
        <p className="text-sm text-amber-700/90 dark:text-amber-400/90">
          Participant data is temporarily unavailable. Other briefing sections remain available.
        </p>
      ) : null}

      <BriefingRecommendedActionHero recommendation={intelligence.primaryRecommendation} />

      <BriefingSectionNav projectId={projectId} />

      <BriefingAgreementHealth health={intelligence.health} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6 min-w-0">
          <BriefingFundingFunnel steps={intelligence.fundingFunnel} />
          <BriefingSettlementBlockersPanel blockers={intelligence.settlementBlockers} />
          <BriefingSummarySection snapshot={intelligence.snapshot} projectId={projectId} />
          <BriefingParticipantsSection
            snapshot={intelligence.snapshot}
            projectId={projectId}
            participantActions={intelligence.participantActions}
          />
          <BriefingCommercialTermsSection snapshot={intelligence.snapshot} projectId={projectId} />
          <BriefingObligationsSection snapshot={intelligence.snapshot} projectId={projectId} />
          <BriefingApprovalsSection snapshot={intelligence.snapshot} />
          <BriefingSettlementSection
            snapshot={intelligence.snapshot}
            projectId={projectId}
            currency={currency}
            releaseConfidence={guidance.releaseConfidence}
            onTreasuryChange={handleTreasuryChange}
          />
          <BriefingActivitySection activityEntries={auditEntries} />
          <BriefingAuditSection auditEntries={auditEntries} />
        </div>

        <BriefingIntelligencePanel intelligence={intelligence} />
      </div>

      {obligationsLoading ? (
        <p className="text-xs text-muted-foreground text-center pb-4">Refreshing obligation data…</p>
      ) : null}
    </div>
  );
}
