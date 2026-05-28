'use client';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { parseCoordinationSnapshotProjection } from '@/lib/operations/selectors/operational-coordination-snapshot';
import {
  assertPostConvergenceIntegrity,
  type PostConvergenceIntegrityInput,
} from '@/lib/operations/dev/assert-post-convergence-integrity';
import { markOperationalConvergenceComplete } from '@/lib/operations/dev/operational-render-trace';
import type { OperationalSyncMutationKind } from '@/lib/operations/orchestration/operational-sync-convergence';
import type { OperationalSyncResponse } from '@/lib/operations/orchestration/operational-sync-client';

export type CoordinationSnapshotVerificationPayload = {
  snapshot: OperationalCoordinationSnapshot;
  obligationCount: number;
};

export async function fetchCoordinationSnapshotAfterConvergence(
  projectId: string | null | undefined
): Promise<CoordinationSnapshotVerificationPayload | null> {
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

export async function fetchActivationMetricsAfterConvergence(): Promise<
  PostConvergenceIntegrityInput['activation'] | null
> {
  const res = await fetch('/api/workspace/activation', { cache: 'no-store', credentials: 'include' });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    activation?: {
      participantCount: number;
      participantsConfiguredCount: number;
      obligationCount: number;
      releaseEligibleCount: number;
    };
    data?: { activation?: PostConvergenceIntegrityInput['activation'] };
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

/** Build verifier run immediately after awaited applyOperationalSyncConvergence. */
export function createPostConvergenceVerifier(input: {
  mutation: OperationalSyncMutationKind;
  projectId?: string | null;
  surface?: string;
  participants: DemoParticipant[];
  sync?: OperationalSyncResponse['operationalSync'];
  obligationsTableRowCount?: number;
  treasuryHasFundingSources?: boolean;
  activationInput?: {
    primaryProjectId?: string | null;
    participantCount?: number;
    participantsConfiguredCount?: number;
    obligationCount?: number;
    releaseEligibleCount?: number;
    releaseBatchCount?: number;
    workspaceCreated?: boolean;
    onboardingCompleted?: boolean;
    projectCreated?: boolean;
    revenueConfigured?: boolean;
    defaultCurrency?: string;
    providerConnected?: boolean;
    firstReleaseCompleted?: boolean;
  };
}): () => Promise<void> {
  return async () => {
    const fetched = await fetchCoordinationSnapshotAfterConvergence(input.projectId);
    if (!fetched) return;
    const graph = fetched.snapshot;
    const obligationCount = fetched.obligationCount;

    const activationMetrics =
      (await fetchActivationMetricsAfterConvergence()) ??
      (input.activationInput
        ? {
            participantCount: input.activationInput.participantCount ?? 0,
            participantsConfiguredCount: input.activationInput.participantsConfiguredCount ?? 0,
            obligationCount: input.activationInput.obligationCount ?? 0,
            releaseEligibleCount: input.activationInput.releaseEligibleCount,
          }
        : null);

    const canonicalState = buildCanonicalStateFromSnapshot(graph, {
      activation: {
        hasOrganization: input.activationInput?.workspaceCreated ?? true,
        onboardingCompleted: input.activationInput?.onboardingCompleted ?? true,
        projectCreated: input.activationInput?.projectCreated ?? true,
        participantCount: Math.max(
          input.activationInput?.participantCount ?? 0,
          graph.summary.participantCount
        ),
        participantsConfigured: graph.summary.earningsConfiguredCount >= graph.summary.participantCount,
        participantsConfiguredCount: graph.summary.earningsConfiguredCount,
        obligationCount: Math.max(input.activationInput?.obligationCount ?? 0, obligationCount),
        paymentLinkCount: 0,
        collectionPreferenceDecideLater: !(input.activationInput?.revenueConfigured ?? false),
        defaultCurrency: input.activationInput?.defaultCurrency ?? 'USD',
        stripeConfigured: input.activationInput?.providerConnected ?? false,
        wiseConfigured: false,
        hederaConfigured: false,
        releaseEligibleCount: graph.summary.releaseReadyCount,
        releaseBatchCount: input.activationInput?.firstReleaseCompleted ? 1 : 0,
        primaryProjectId: input.activationInput?.primaryProjectId ?? input.projectId ?? null,
      },
      graphReady: true,
      graphSnapshotConverged: true,
    });

    const verifyInput: PostConvergenceIntegrityInput = {
      mutation: input.mutation,
      projectId: input.projectId,
      surface: input.surface,
      participants: input.participants,
      graphSummary: {
        participantCount: graph.summary.participantCount,
        earningsConfiguredCount: graph.summary.earningsConfiguredCount,
        payoutReadyCount: graph.summary.payoutReadyCount,
        releaseReadyCount: graph.summary.releaseReadyCount,
        obligationCount,
      },
      canonicalKpis: canonicalState?.kpis ?? null,
      activation: activationMetrics,
      sync: input.sync,
      obligationsTableRowCount: input.obligationsTableRowCount,
      fundingAllocated: graph.funding.allocated,
      treasuryHasFundingSources: input.treasuryHasFundingSources,
    };

    assertPostConvergenceIntegrity(verifyInput);

    markOperationalConvergenceComplete({
      mutation: input.mutation,
      kpis: verifyInput.canonicalKpis,
    });
  };
}
