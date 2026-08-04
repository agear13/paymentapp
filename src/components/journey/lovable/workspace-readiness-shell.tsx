'use client';

import { Loader2 } from 'lucide-react';
import { useOrganization } from '@/hooks/use-organization';
import { CommercialReadinessProvider } from '@/hooks/use-commercial-readiness';

function WorkspaceReadinessLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center pb-24">
      <Loader2 className="h-6 w-6 animate-spin text-ink-soft" aria-label="Loading workspace" />
    </div>
  );
}

/**
 * Single Commercial OS readiness boundary — one provider, one fetch, one refresh().
 */
export function WorkspaceReadinessShell({ children }: { children: React.ReactNode }) {
  const { organizationId, isLoading: isOrgLoading } = useOrganization();

  if (isOrgLoading) {
    return <WorkspaceReadinessLoading />;
  }

  if (!organizationId) {
    return <>{children}</>;
  }

  return (
    <CommercialReadinessProvider organizationId={organizationId}>
      {children}
    </CommercialReadinessProvider>
  );
}
