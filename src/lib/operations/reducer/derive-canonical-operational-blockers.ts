import {
  deduplicateReleaseBlockers,
  deriveOperationalReleaseBlockers,
  type OperationalReleaseBlockerDetail,
} from '@/lib/operations/explainability/derive-operational-release-blockers';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import { getOperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type {
  CanonicalOperationalBlocker,
  CanonicalOperationalState,
  CanonicalReleasePhase,
} from '@/lib/operations/reducer/types';

function blockerFingerprint(
  blocker: OperationalReleaseBlockerDetail,
  phase: CanonicalReleasePhase
): string {
  const scope = blocker.participantId ?? 'workspace';
  return `${phase}:${blocker.category}:${scope}`;
}

function snapshotFromCanonicalState(state: CanonicalOperationalState): OperationalCoordinationSnapshot {
  return getOperationalCoordinationSnapshot({
    participants: state.participants.map((row) => row.entity),
    obligations: state.obligations.map((o) => ({
      id: o.obligation.id,
      amount: o.obligation.amount,
      amountFunded: o.obligation.amountFunded,
      currency: o.obligation.currency,
      participantId: o.participantId,
      allocationStatus: o.obligation.allocationStatus,
      readiness: o.obligation.readiness,
    })),
    fundingAllocated: state.funding.allocated,
  });
}

function materializationBlockers(state: CanonicalOperationalState): OperationalReleaseBlockerDetail[] {
  const blockers: OperationalReleaseBlockerDetail[] = [];
  const payoutReadyWithoutObligation = state.participants.filter(
    (p) =>
      p.payoutReadiness.payoutReady &&
      !state.obligations.some((o) => o.participantId === p.participantId)
  );

  if (payoutReadyWithoutObligation.length > 0 && state.readiness.graphConverged) {
    const count = payoutReadyWithoutObligation.length;
    blockers.push({
      id: 'obligation-materialization-pending',
      category: 'obligation_sync_pending',
      reason: `${count} payout-ready participant${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} not yet materialized into obligations.`,
      remediation:
        'Refresh operational coordination so approved agreements and funding converge into obligation records.',
      unlockCondition:
        'Canonical reducer materializes obligations for all payout-ready participants with funding.',
      ctaLabel: 'Refresh obligations',
      ctaHref: '/api/deal-network-pilot/obligations/refresh',
      ctaIntent: 'review_obligations',
      operatorActionRequired: false,
      severity: 'blocking',
    });
  }

  return blockers;
}

/** Single blocker engine — all pages must consume this output only. */
export function deriveCanonicalOperationalBlockers(
  state: CanonicalOperationalState
): CanonicalOperationalBlocker[] {
  const phase = state.release.phase;
  const snapshot = snapshotFromCanonicalState(state);
  const workspace = state.coordination.workspace ?? undefined;

  const base = deriveOperationalReleaseBlockers({
    snapshot,
    workspace,
    graphReady: state.readiness.graphReady,
    initializationRecoveryMessage: state.readiness.graphConverged
      ? null
      : 'Operational graph is converging — projections may be temporarily incomplete.',
  });

  const merged = deduplicateReleaseBlockers([
    ...base,
    ...materializationBlockers(state),
  ]);

  const seen = new Set<string>();
  const canonical: CanonicalOperationalBlocker[] = [];

  for (const blocker of merged) {
    const fingerprint = blockerFingerprint(blocker, phase);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    canonical.push({
      ...blocker,
      fingerprint,
      phase,
      source: 'reducer',
    });
  }

  return canonical;
}
