'use client';

import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';

export function ProjectFundingView() {
  const { summary, projectId, refresh } = useProjectWorkspace();
  if (!summary) return null;

  const defaultCurrency = summary.currencyLabel.includes('AUD') ? 'AUD' : 'USD';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
          Track expected inflows and payout readiness across projects. Coordinate obligations before
          revenue fully settles.
        </p>
      </div>

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={defaultCurrency}
        onTreasuryChange={() => void refresh({ scope: 'all', silent: true, force: true })}
      />
    </div>
  );
}
