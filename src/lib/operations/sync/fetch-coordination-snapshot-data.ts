'use client';

import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { parseCoordinationSnapshotProjection } from '@/lib/operations/selectors/operational-coordination-snapshot';

export type CoordinationSnapshotFetchResult = {
  snapshot: OperationalCoordinationSnapshot;
  obligationCount: number;
};

export type ActivationMetricsFetchResult = {
  participantCount: number;
  participantsConfiguredCount: number;
  obligationCount: number;
  releaseEligibleCount?: number;
};

export async function fetchCoordinationSnapshotAfterConvergence(
  projectId: string | null | undefined
): Promise<CoordinationSnapshotFetchResult | null> {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`/api/operations/coordination-snapshot${qs}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: {
      graphReady?: boolean;
      summary: OperationalCoordinationSnapshot['summary'] | null;
      funding: OperationalCoordinationSnapshot['funding'] | null;
      participants: OperationalCoordinationSnapshot['participants'];
      obligationCount?: number;
    };
  };
  if (!json.data) return null;
  const projection = parseCoordinationSnapshotProjection({
    graphReady: json.data.graphReady,
    summary: json.data.summary,
    funding: json.data.funding,
    participants: json.data.participants,
  });
  if (!projection) return null;
  const obligationCount = json.data.obligationCount ?? projection.obligations?.length ?? 0;
  return { snapshot: projection, obligationCount };
}

export async function fetchActivationMetricsAfterConvergence(): Promise<ActivationMetricsFetchResult | null> {
  const res = await fetch('/api/workspace/activation', { cache: 'no-store', credentials: 'include' });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    activation?: ActivationMetricsFetchResult;
    data?: { activation?: ActivationMetricsFetchResult };
  };
  const act = json.activation ?? json.data?.activation;
  if (!act) return null;
  return {
    participantCount: act.participantCount,
    participantsConfiguredCount: act.participantsConfiguredCount,
    obligationCount: act.obligationCount,
    releaseEligibleCount: act.releaseEligibleCount,
  };
}
