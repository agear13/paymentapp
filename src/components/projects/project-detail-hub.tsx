'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ProjectStateChip,
  ReleaseConfidenceChip,
  RevenueSettlementChip,
} from '@/components/operations/operational-chips';
import { safeProjectState } from '@/lib/operations/guards/hydration-guards';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalGraphDiagnostics } from '@/components/operations/operational-graph-diagnostics';
import { OperationalDiagnosticsPanel } from '@/components/operations/operational-diagnostics-panel';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import { ProjectOperationalCompletenessCard } from '@/components/projects/project-operational-completeness-card';
import { ProjectOperationalLoadingState } from '@/components/projects/project-operational-loading-state';
import {
  projectFundingPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';
import { ProjectReadinessBreakdown } from '@/components/projects/project-readiness-breakdown';
import { safeProjectOperationalState } from '@/lib/operational/safe-operational-hydration';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  const {
    summary,
    deal,
    refresh,
    projectParticipants,
    loading,
    notFound,
    sectionErrors,
    refreshSilent,
    invalidate,
  } = useProjectWorkspace();
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const { guidance, graph, workspaceContext, kpis, reloadCoordinationSnapshot } =
    useOperationalCoordinationState({
      scope: 'project',
      project: deal ?? undefined,
      participants: projectParticipants,
      treasury,
      scopeTitle: summary?.name,
      enabled: Boolean(deal),
      traceSurface: 'project-detail-hub',
    });

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/treasury-summary`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data: ProjectTreasurySummary };
        if (!cancelled) setTreasury(json.data);
      } catch {
        if (!cancelled) setTreasury(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, summary?.treasury?.fundingSourceCount]);

  if (loading && !summary) {
    return <ProjectOperationalLoadingState variant="loading" />;
  }

  if (notFound) {
    return (
      <ProjectOperationalLoadingState
        variant="error"
        message="This project could not be found. It may still be syncing from onboarding."
      />
    );
  }

  if (!summary || !deal) {
    return (
      <ProjectOperationalLoadingState
        variant="configuring"
        message="This project is still being configured."
        onRetry={() => {
          invalidate('all');
          void refresh({ scope: 'all', force: true });
        }}
      />
    );
  }

  const participantsHref = projectParticipantsPath(projectId);
  const fundingHref = projectFundingPath(projectId);
  const payoutsHref = projectPayoutsPath(projectId);
  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: treasury?.currency,
    workspaceDefaultCurrency: workspaceContext.defaultCurrency,
  });
  const opState = safeProjectOperationalState(deal, projectParticipants, {
    revenueConfigured: treasury?.hasFundingSources ?? false,
    obligationCount: kpis?.obligationCount ?? summary.treasury?.obligationsReady ?? 0,
  });
  const projectState = safeProjectState(deal);
  const releaseConfidence = guidance.releaseConfidence;

  return (
    <div className="space-y-8">
      {opState.guidance ? (
        <ProjectOperationalLoadingState variant="configuring" message={opState.guidance} />
      ) : null}

      {sectionErrors.participants ? (
        <p className="text-sm text-amber-700/90 dark:text-amber-400/90">
          Participant data is temporarily unavailable. Other project views remain open.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{summary.name}</h1>
          {summary.description ? (
            <p className="text-muted-foreground mt-1 max-w-2xl">{summary.description}</p>
          ) : (
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Coordinate participants, funding, obligations, and payouts for this project.
              Configure how each participant earns before tracking obligations or releases.
            </p>
          )}
        </div>
        <Button asChild className="w-fit">
          <Link href={participantsHref}>Manage participants</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <ProjectStateChip state={projectState} />
        <ReleaseConfidenceChip level={releaseConfidence.level} />
        {treasury ? (
          <RevenueSettlementChip
            label={treasury.fundingLabel}
            health={
              treasury.projectHealth === 'settlement_risk'
                ? 'risk'
                : treasury.projectHealth === 'ready_for_payout'
                  ? 'healthy'
                  : 'pending'
            }
          />
        ) : (
          <Badge variant="secondary">{summary.operationalStageLabel}</Badge>
        )}
        <Badge variant="outline">{opState.setupStatus}</Badge>
        <Badge variant="outline">{summary.settlementStatus}</Badge>
        <Badge variant="outline">{summary.currencyLabel}</Badge>
        {summary.needsAttention ? (
          <Badge variant="outline" className="border-amber-500/35 text-amber-800">
            Needs attention
          </Badge>
        ) : null}
      </div>

      <ProjectOperationalCompletenessCard
        project={deal}
        participants={projectParticipants}
        revenueConfigured={treasury?.hasFundingSources ?? false}
        obligationCount={kpis?.obligationCount ?? summary.treasury?.obligationsReady ?? 0}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </CardDescription>
            <CardTitle className="text-2xl">
              {summary.participantCount === 0
                ? '—'
                : `${summary.participantsReady}/${summary.participantCount}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ProjectReadinessBreakdown
              participants={projectParticipants}
              projectId={projectId}
              graphParticipants={graph.participants}
              graphSummary={graph.summary}
            />
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href={participantsHref}>Manage participants</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Funding sources
            </CardDescription>
            <CardTitle className="text-lg">{summary.fundingLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{summary.fundingSubcopy}</p>
            <Button asChild variant="outline" size="sm">
              <Link href={fundingHref}>Manage funding</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Payouts
            </CardDescription>
            <CardTitle className="text-lg">{summary.payoutLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={payoutsHref}>View payouts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={currency}
        onTreasuryChange={() => {
          notifyWorkspaceActivationRefresh();
          void refresh({ scope: 'all', silent: true, force: true });
        }}
      />

      <OperationalActivitySection projectId={projectId} defaultOpen={false} />

      <OperationalGraphDiagnostics />

      <OperationalDiagnosticsPanel
        projectId={projectId}
        participants={projectParticipants}
        invalidate={invalidate}
        refreshSilent={refreshSilent}
        reloadCoordinationSnapshot={reloadCoordinationSnapshot}
      />
    </div>
  );
}
