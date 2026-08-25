'use client';

import { CommercialWorkspaceOperatorLayout } from '@/components/journey/lovable/commercial-workspace-operator-layout';
import { CommercialWorkspaceOverviewPanel } from '@/components/journey/lovable/commercial-workspace-overview-panel';

/** Standalone mount for tests and any remaining direct imports. Route pages use the layout. */
export function CommercialWorkspaceDetailScreen({ workspaceId }: { workspaceId: string }) {
  return (
    <CommercialWorkspaceOperatorLayout workspaceId={workspaceId}>
      <CommercialWorkspaceOverviewPanel />
    </CommercialWorkspaceOperatorLayout>
  );
}
