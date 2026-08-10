'use client';

import { useOrganization } from '@/hooks/use-organization';
import { HistoricalAccountingSyncReviewScreen } from '@/components/journey/lovable/historical-accounting-sync-review-screen';

export function HistoricalAccountingSyncPageClient() {
  const { organizationId } = useOrganization();

  if (!organizationId) {
    return null;
  }

  return <HistoricalAccountingSyncReviewScreen organizationId={organizationId} />;
}
