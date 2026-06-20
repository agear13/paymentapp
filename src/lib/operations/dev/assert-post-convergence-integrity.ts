import { OperationalInvariantViolation } from '@/lib/operations/dev/operational-invariants';
import { countPersistedParticipantMetrics } from '@/lib/operations/dev/count-persisted-participant-metrics';
import type { PostConvergenceIntegrityInput } from '@/lib/operations/dev/post-convergence-integrity-types';
import type { PostConvergenceIntegrityViolation } from '@/lib/operations/dev/post-convergence-integrity-types';

export type {
  ActivationMetricsSnapshot,
  CoordinationSnapshotSummary,
  PostConvergenceIntegrityInput,
} from '@/lib/operations/dev/post-convergence-integrity-types';

function fail(
  violations: PostConvergenceIntegrityViolation[],
  code: string,
  message: string
): void {
  violations.push({ code, message });
}

function checkEq(
  violations: PostConvergenceIntegrityViolation[],
  code: string,
  label: string,
  expected: number | boolean,
  actual: number | boolean | undefined | null,
  mutation: PostConvergenceIntegrityInput['mutation']
): void {
  if (actual === undefined || actual === null) return;
  if (expected !== actual) {
    fail(
      violations,
      code,
      `[${mutation}] ${label}: expected ${String(expected)} after convergence, got ${String(actual)}`
    );
  }
}

/** Pure validation — collects violations without telemetry or orchestration side effects. */
export function collectPostConvergenceIntegrityViolations(
  input: PostConvergenceIntegrityInput
): PostConvergenceIntegrityViolation[] {
  const violations: PostConvergenceIntegrityViolation[] = [];
  const rowMetrics = countPersistedParticipantMetrics(input.participants);
  const graph = input.graphSummary;
  const kpis = input.canonicalKpis;
  const activation = input.activation;
  const sync = input.sync;

  checkEq(
    violations,
    'POST_CONVERGENCE_GRAPH_PARTICIPANT_COUNT_MISMATCH',
    'coordination-snapshot participantCount vs persisted rows',
    rowMetrics.participantCount,
    graph.participantCount,
    input.mutation
  );
  checkEq(
    violations,
    'POST_CONVERGENCE_GRAPH_EARNINGS_MISMATCH',
    'coordination-snapshot earningsConfiguredCount vs persisted rows',
    rowMetrics.earningsConfiguredCount,
    graph.earningsConfiguredCount,
    input.mutation
  );
  checkEq(
    violations,
    'POST_CONVERGENCE_GRAPH_PAYOUT_READY_MISMATCH',
    'coordination-snapshot payoutReadyCount vs persisted rows',
    rowMetrics.payoutReadyCount,
    graph.payoutReadyCount,
    input.mutation
  );

  if (kpis) {
    checkEq(
      violations,
      'POST_CONVERGENCE_CANONICAL_EARNINGS_MISMATCH',
      'canonical KPI earningsConfiguredCount vs persisted rows',
      rowMetrics.earningsConfiguredCount,
      kpis.earningsConfiguredCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_CANONICAL_PAYOUT_READY_MISMATCH',
      'canonical KPI payoutReadyCount vs persisted rows',
      rowMetrics.payoutReadyCount,
      kpis.payoutReadyCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_CANONICAL_OBLIGATION_MISMATCH',
      'canonical KPI obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis.obligationCount,
      kpis.obligationCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_CANONICAL_VS_GRAPH_EARNINGS',
      'canonical KPI vs coordination-snapshot earnings',
      graph.earningsConfiguredCount,
      kpis.earningsConfiguredCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_CANONICAL_VS_GRAPH_PAYOUT_READY',
      'canonical KPI vs coordination-snapshot payoutReady',
      graph.payoutReadyCount,
      kpis.payoutReadyCount,
      input.mutation
    );
  }

  if (activation) {
    checkEq(
      violations,
      'POST_CONVERGENCE_ACTIVATION_EARNINGS_MISMATCH',
      'workspace activation participantsConfiguredCount vs persisted rows',
      rowMetrics.earningsConfiguredCount,
      activation.participantsConfiguredCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_ACTIVATION_VS_CANONICAL_EARNINGS',
      'activation vs canonical earningsConfiguredCount',
      kpis?.earningsConfiguredCount ?? graph.earningsConfiguredCount,
      activation.participantsConfiguredCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_ACTIVATION_OBLIGATION_MISMATCH',
      'activation obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis?.obligationCount ?? 0,
      activation.obligationCount,
      input.mutation
    );
  }

  if (sync) {
    checkEq(
      violations,
      'POST_CONVERGENCE_SYNC_PAYOUT_READY_MISMATCH',
      'operationalSync payoutReadyCount vs coordination snapshot',
      graph.payoutReadyCount,
      sync.payoutReadyCount,
      input.mutation
    );
    checkEq(
      violations,
      'POST_CONVERGENCE_SYNC_OBLIGATION_MISMATCH',
      'operationalSync obligationCount vs coordination snapshot',
      graph.obligationCount ?? kpis?.obligationCount ?? 0,
      sync.obligationCount,
      input.mutation
    );
  }

  if (input.obligationsTableRowCount != null) {
    const expectedObligationCount = graph.obligationCount ?? kpis?.obligationCount ?? 0;
    checkEq(
      violations,
      'POST_CONVERGENCE_OBLIGATIONS_TABLE_MISMATCH',
      'obligations table row count vs canonical obligationCount',
      expectedObligationCount,
      input.obligationsTableRowCount,
      input.mutation
    );
  }

  const persistedRowCount = input.participants.filter((p) => p.name?.trim()).length;
  if (persistedRowCount > 0 && rowMetrics.participantCount === 0) {
    fail(
      violations,
      'PERSISTED_PARTICIPANTS_DISAPPEARED_FROM_CANONICAL',
      `[${input.mutation}] Persisted participant rows exist but canonical participantCount is zero`
    );
  }

  const floorPayoutReady = input.minPayoutReadyCount ?? rowMetrics.payoutReadyCount;
  if (rowMetrics.payoutReadyCount < floorPayoutReady) {
    fail(
      violations,
      'PAYOUT_READY_REGRESSION_AFTER_PERSISTENCE',
      `[${input.mutation}] payout-ready count regressed (${rowMetrics.payoutReadyCount} < ${floorPayoutReady})`
    );
  }
  if (sync?.payoutReadyCount != null && sync.payoutReadyCount < rowMetrics.payoutReadyCount) {
    fail(
      violations,
      'PAYOUT_READY_SYNC_REGRESSION',
      `[${input.mutation}] operationalSync payoutReadyCount regressed below persisted rows`
    );
  }

  if (input.obligationsTableSuppressed === true && (input.obligationsTableRowCount ?? 0) > 0) {
    fail(
      violations,
      'OBLIGATIONS_TABLE_SUPPRESSED_WITH_ROWS',
      `[${input.mutation}] Obligations table rows exist but UI suppressed obligations`
    );
  }

  if (
    input.treasuryHasFundingSources === true &&
    input.fundingAllocated === false &&
    rowMetrics.participantCount > 0
  ) {
    fail(
      violations,
      'POST_CONVERGENCE_FUNDING_CONNECTED_BUT_GRAPH_NOT_ALLOCATED',
      `[${input.mutation}] Treasury reports funding sources but coordination snapshot funding.allocated is false after convergence`
    );
  }

  return violations;
}

/** Throws in development when violations exist; production callers use the runner for telemetry. */
export function assertPostConvergenceIntegrity(input: PostConvergenceIntegrityInput): void {
  const violations = collectPostConvergenceIntegrityViolations(input);
  if (violations.length === 0) return;

  if (process.env.NODE_ENV === 'development') {
    console.groupCollapsed('[operational-sync] post-convergence-verified');
    console.log('mutation', input.mutation);
    console.log('surface', input.surface ?? null);
    console.log('violations', violations);
    console.groupEnd();
    throw new OperationalInvariantViolation(violations[0]!.code, violations[0]!.message);
  }
}
