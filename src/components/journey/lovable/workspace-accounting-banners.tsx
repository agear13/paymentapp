'use client';

import { useOrganization } from '@/hooks/use-organization';
import { HistoricalAccountingSyncBanner } from '@/components/journey/lovable/historical-accounting-sync-banner';

export function WorkspaceAccountingBanners() {
  const { organizationId } = useOrganization();

  if (!organizationId) return null;

  return <HistoricalAccountingSyncBanner organizationId={organizationId} />;
}
