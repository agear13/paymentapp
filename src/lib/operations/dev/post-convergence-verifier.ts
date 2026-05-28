'use client';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildCanonicalStateFromSnapshot } from '@/lib/operations/reducer/adapters/legacy-selectors';
import {
  fetchActivationMetricsAfterConvergence,
  fetchCoordinationSnapshotAfterConvergence,
} from '@/lib/operations/sync/fetch-coordination-snapshot-data';
import type {
  OperationalSyncMutationKind,
  OperationalSyncPayload,
} from '@/lib/operations/sync/operational-sync-types';
import { runPostConvergenceIntegrityCheck } from '@/lib/operations/dev/post-convergence-integrity-runner';
import type { PostConvergenceIntegrityInput } from '@/lib/operations/dev/post-convergence-integrity-types';
import { markOperationalConvergenceComplete } from '@/lib/operations/dev/operational-render-trace';

export function createPostConvergenceVerifier(input: {
  mutation: OperationalSyncMutationKind;
  projectId?: string | null;
  surface?: string;
  participants: DemoParticipant[];
  sync?: OperationalSyncPayload;
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

    runPostConvergenceIntegrityCheck(verifyInput);

    markOperationalConvergenceComplete({
      mutation: input.mutation,
      kpis: verifyInput.canonicalKpis,
    });
  };
}
