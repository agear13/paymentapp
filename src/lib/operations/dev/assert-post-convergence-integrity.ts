import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import { OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';
import { countPersistedParticipantMetrics } from '@/lib/operations/dev/count-persisted-participant-metrics';
import type { OperationalSyncMutationKind } from '@/lib/operations/orchestration/operational-sync-convergence';
import { emitOperationalTelemetry } from '@/lib/operations/telemetry/operational-telemetry';

export type CoordinationSnapshotSummary = {
  participantCount: number;
  earningsConfiguredCount: number;
  payoutReadyCount: number;
  releaseReadyCount?: number;
  obligationCount?: number;
};

export type ActivationMetricsSnapshot = {
  participantsConfiguredCount: number;
  participantCount: number;
  obligationCount: number;
  releaseEligibleCount?: number;
};

export type PostConvergenceIntegrityInput = {
  mutation: OperationalSyncMutationKind;
  projectId?: string | null;
  surface?: string;
  participants: DemoParticipant[];
  graphSummary: CoordinationSnapshotSummary;
  canonicalKpis: OperationalKPIs | null;
  activation?: ActivationMetricsSnapshot | null;
  sync?: {
    payoutReadyCount?: number;
    obligationCount?: number;
    releaseEligibleObligationCount?: number;
  } | null;
  obligationsTableRowCount?: number;
  obligationsTableSuppressed?: boolean;
  fundingAllocated?: boolean;
  treasuryHasFundingSources?: boolean;
  /** Minimum payout-ready count after successful persistence — regression guard. */
  minPayoutReadyCount?: number;
};

function assertEq(
  code: string,
  label: string,
  expected: number | boolean,
  actual: number | boolean | undefined | null,
  mutation: OperationalSyncMutationKind,
  surface?: string
): void {
  if (actual === undefined || actual === null) return;
  if (expected !== actual) {
    reportIntegrityFailure(
      code,
      `[${mutation}] ${label}: expected ${String(expected)} after convergence, got ${String(actual)}`,
      mutation,
      surface
    );
  }
}

/**
 * Dev-only — throws immediately when any operational surface disagrees after awaited convergence.
 * Persisted server entities and coordination-snapshot are the only truth inputs.
 */
function reportIntegrityFailure(
  code: string,
  message: string,
  mutation: OperationalSyncMutationKind,
  surface?: string
): void {
  emitOperationalTelemetry({
    type: 'post_convergence_assertion_failure',
    code,
    mutation,
    message,
  });
  emitOperationalTelemetry({
    type: 'cross_surface_mismatch',
    code,
    mutation,
    surface: surface ?? null,
    detail: { message },
  });
  if (process.env.NODE_ENV !== 'development') return;
  throw new OperationalInvariantViolation(code, message);
}

export function assertPostConvergenceIntegrity(input: PostConvergenceIntegrityInput): void {
  const rowMetrics = countPersistedParticipantMetrics(input.participants);
  const graph = input.graphSummary;
  const kpis = input.canonicalKpis;
  const activation = input.activation;
  const sync = input.sync;

  assertEq(
    'POST_CONVERGENCE_GRAPH_PARTICIPANT_COUNT_MISMATCH',
    'coordination-snapshot participantCount vs persisted rows',
    rowMetrics.participantCount,
    graph.participantCount,
    input.mutation
  );
  assertEq(
    'POST_CONVERGENCE_GRAPH_EARNINGS_MISMATCH',
    'coordination-snapshot earningsConfiguredCount vs persisted rows',
    rowMetrics.earningsConfiguredCount,
    graph.earningsConfiguredCount,
    input.mutation
  );
  assertEq(
    'POST_CONVERGENCE_GRAPH_PAYOUT_READY_MISMATCH',
    'coordination-snapshot payoutReadyCount vs persisted rows',
    rowMetrics.payoutReadyCount,
    graph.payoutReadyCount,
    input.mutation
  );

  if (kpis) {
    assertEq(
      'POST_CONVERGENCE_CANONICAL_EARNINGS_MISMATCH',
      'canonical KPI earningsConfiguredCount vs persisted rows',
      rowMetrics.earningsConfiguredCount,
      kpis.earningsConfiguredCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_CANONICAL_PAYOUT_READY_MISMATCH',
      'canonical KPI payoutReadyCount vs persisted rows',
      rowMetrics.payoutReadyCount,
      kpis.payoutReadyCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_CANONICAL_OBLIGATION_MISMATCH',
      'canonical KPI obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis.obligationCount,
      kpis.obligationCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_CANONICAL_VS_GRAPH_EARNINGS',
      'canonical KPI vs coordination-snapshot earnings',
      graph.earningsConfiguredCount,
      kpis.earningsConfiguredCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_CANONICAL_VS_GRAPH_PAYOUT_READY',
      'canonical KPI vs coordination-snapshot payoutReady',
      graph.payoutReadyCount,
      kpis.payoutReadyCount,
      input.mutation
    );
  }

  if (activation) {
    assertEq(
      'POST_CONVERGENCE_ACTIVATION_EARNINGS_MISMATCH',
      'workspace activation participantsConfiguredCount vs persisted rows',
      rowMetrics.earningsConfiguredCount,
      activation.participantsConfiguredCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_ACTIVATION_VS_CANONICAL_EARNINGS',
      'activation vs canonical earningsConfiguredCount',
      kpis?.earningsConfiguredCount ?? graph.earningsConfiguredCount,
      activation.participantsConfiguredCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_ACTIVATION_OBLIGATION_MISMATCH',
      'activation obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis?.obligationCount ?? 0,
      activation.obligationCount,
      input.mutation
    );
  }

  if (sync) {
    assertEq(
      'POST_CONVERGENCE_SYNC_PAYOUT_READY_MISMATCH',
      'operationalSync payoutReadyCount vs coordination snapshot',
      graph.payoutReadyCount,
      sync.payoutReadyCount,
      input.mutation
    );
    assertEq(
      'POST_CONVERGENCE_SYNC_OBLIGATION_MISMATCH',
      'operationalSync obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis?.obligationCount ?? 0,
      sync.obligationCount,
      input.mutation
    );
  }

  if (input.obligationsTableRowCount != null) {
    const expectedObligations = graph.obligationCount ?? kpis?.obligationCount ?? 0;
    assertEq(
      'POST_CONVERGENCE_OBLIGATIONS_TABLE_MISMATCH',
      'obligations table row count vs canonical obligationCount',
      expectedObligations,
      input.obligationsTableRowCount,
      input.mutation
    );
  }

  const persistedRowCount = input.participants.filter((p) => p.name?.trim()).length;
  if (persistedRowCount > 0 && rowMetrics.participantCount === 0) {
    reportIntegrityFailure(
      'PERSISTED_PARTICIPANTS_DISAPPEARED_FROM_CANONICAL',
      `[${input.mutation}] Persisted participant rows exist but canonical participantCount is zero`,
      input.mutation,
      input.surface
    );
  }

  const floorPayoutReady = input.minPayoutReadyCount ?? rowMetrics.payoutReadyCount;
  if (rowMetrics.payoutReadyCount < floorPayoutReady) {
    reportIntegrityFailure(
      'PAYOUT_READY_REGRESSION_AFTER_PERSISTENCE',
      `[${input.mutation}] payout-ready count regressed (${rowMetrics.payoutReadyCount} < ${floorPayoutReady})`,
      input.mutation,
      input.surface
    );
  }
  if (
    sync?.payoutReadyCount != null &&
    sync.payoutReadyCount < rowMetrics.payoutReadyCount
  ) {
    reportIntegrityFailure(
      'PAYOUT_READY_SYNC_REGRESSION',
      `[${input.mutation}] operationalSync payoutReadyCount regressed below persisted rows`,
      input.mutation,
      input.surface
    );
  }

  if (
    input.obligationsTableSuppressed === true &&
    (input.obligationsTableRowCount ?? 0) > 0
  ) {
    reportIntegrityFailure(
      'OBLIGATIONS_TABLE_SUPPRESSED_WITH_ROWS',
      `[${input.mutation}] Obligations table rows exist but UI suppressed obligations`,
      input.mutation,
      input.surface
    );
  }

  if (
    input.treasuryHasFundingSources === true &&
    input.fundingAllocated === false &&
    rowMetrics.participantCount > 0
  ) {
    reportIntegrityFailure(
      'POST_CONVERGENCE_FUNDING_CONNECTED_BUT_GRAPH_NOT_ALLOCATED',
      `[${input.mutation}] Treasury reports funding sources but coordination snapshot funding.allocated is false after convergence`,
      input.mutation,
      input.surface
    );
  }

  if (process.env.NODE_ENV === 'development') {
    console.groupCollapsed('[operational-sync] post-convergence-verified');
    console.log('mutation', input.mutation);
    console.log('surface', input.surface ?? null);
    console.log('rowMetrics', rowMetrics);
    console.log('graphSummary', graph);
    console.log('canonicalKpis', kpis);
    console.log('activation', activation);
    console.groupEnd();
  }
}
