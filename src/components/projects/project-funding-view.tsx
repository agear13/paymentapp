'use client';

import * as React from 'react';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { toOperationalSyncHandlers } from '@/lib/operations/orchestration/operational-sync-client';
import { ProjectPageCopilot } from '@/components/operations/project-page-copilot';

export function ProjectFundingView() {
  const { summary, projectId, deal, projectParticipants, refresh, invalidate } =
    useProjectWorkspace();
  const { guidance, workspaceContext, activation, reloadCoordinationSnapshot } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    treasury: summary?.treasury ?? undefined,
    enabled: Boolean(deal),
    traceSurface: 'project-funding-view',
  });

  const operationalSyncHandlers = React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate,
        refreshSilent: (scope) =>
          refresh({ scope: scope ?? 'all', silent: true, force: true }),
        reloadCoordinationSnapshot,
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    [invalidate, refresh, reloadCoordinationSnapshot]
  );

  if (!summary) return null;

  const defaultCurrency = summary.currencyLabel.includes('AUD') ? 'AUD' : 'USD';

  return (
    <div className="space-y-6">
      {/* Persistent copilot — powered by CommercialBrainContext (no props needed) */}
      <ProjectPageCopilot page="money" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Manage how revenue flows into this agreement and how payouts are distributed to team
          members.
        </p>
      </div>

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={defaultCurrency}
        operationalSyncHandlers={operationalSyncHandlers}
        onTreasuryChange={() =>
          void refresh({ scope: 'all', silent: true, force: true })
        }
      />
    </div>
  );
}
