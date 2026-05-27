import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  assertGraphGuidanceInvariants,
  assertSettlementReleaseInvariants,
} from '@/lib/operations/dev/operational-invariants';
import {
  deriveOperationalReleaseBlockers,
  releaseBlockerSummaryLines,
  type OperationalReleaseBlockerDetail,
} from '@/lib/operations/explainability/derive-operational-release-blockers';

export type OperationalBlockingAction = {
  id: string;
  title: string;
  description: string;
  href?: string;
  ctaLabel?: string;
};

export type OperationalBlockingCause = {
  code: string;
  explanation: string;
  layer: string;
  severity: 'blocking' | 'warning';
};

export type OperationalBlockingActionsResult = {
  blockers: OperationalBlockingCause[];
  detailedBlockers: OperationalReleaseBlockerDetail[];
  warnings: string[];
  nextActions: OperationalBlockingAction[];
  readinessExplanation: { headline: string; bullets: string[] };
  blockingLayer: string | null;
  releaseBlockedReason: string | null;
};

export type OperationalBlockingActionsOptions = {
  graphReady?: boolean;
  initializationRecoveryMessage?: string | null;
};

function blockerFromDetail(detail: OperationalReleaseBlockerDetail): OperationalBlockingCause {
  return {
    code: detail.id,
    explanation: detail.reason,
    layer: detail.category,
    severity: detail.severity,
  };
}

function actionFromDetail(detail: OperationalReleaseBlockerDetail): OperationalBlockingAction {
  return {
    id: detail.id,
    title: detail.remediation,
    description: detail.unlockCondition,
    href: detail.ctaHref,
    ctaLabel: detail.ctaLabel,
  };
}

function uniqueBlockers(causes: OperationalBlockingCause[]): OperationalBlockingCause[] {
  const seen = new Set<string>();
  const out: OperationalBlockingCause[] = [];
  for (const cause of causes) {
    const key = `${cause.layer}:${cause.explanation}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cause);
  }
  return out;
}

/** True when funding + all participants converge to release-ready through the graph. */
export function isSettlementReleaseReady(snapshot: OperationalCoordinationSnapshot): boolean {
  const fundingReady = !snapshot.funding?.stage?.blockerLabel;
  const allParticipantsReady =
    snapshot.summary.participantCount > 0 &&
    snapshot.summary.releaseReadyCount === snapshot.summary.participantCount;
  return fundingReady && allParticipantsReady;
}

/**
 * Canonical blocker/action derivation — all guidance surfaces must consume this output.
 */
export function deriveOperationalBlockingActions(
  snapshot: OperationalCoordinationSnapshot,
  workspace?: WorkspaceOperationalContext,
  options: OperationalBlockingActionsOptions = {}
): OperationalBlockingActionsResult {
  const graphReady = options.graphReady ?? true;
  const initializationRecoveryMessage = options.initializationRecoveryMessage;

  const detailedBlockers = deriveOperationalReleaseBlockers({
    snapshot,
    workspace,
    graphReady,
    initializationRecoveryMessage,
  });
  const blockers = uniqueBlockers(detailedBlockers.map(blockerFromDetail));
  const settlementReady = isSettlementReleaseReady(snapshot);
  const releaseReady = snapshot.summary.releaseReadyCount > 0;
  const hasBlockers = blockers.length > 0;
  const blockingLayer = hasBlockers ? blockers[0]?.layer ?? null : null;
  const releaseBlockedReason = hasBlockers ? detailedBlockers[0]?.reason ?? null : null;

  const warnings = uniqueBlockers(
    snapshot.participants.flatMap((p) =>
      (p.readinessHierarchy?.funding?.blockers ?? []).map((explanation) => ({
        code: `funding-warning-${p.participant?.id ?? 'unknown'}`,
        explanation,
        layer: 'funding',
        severity: 'warning' as const,
      }))
    )
  ).map((c) => c.explanation);

  const readinessExplanation = {
    headline:
      settlementReady || (releaseReady && !hasBlockers)
        ? 'Ready for payout release'
        : hasBlockers
          ? 'Release blocked because:'
          : releaseReady
            ? 'Ready for payout release'
            : 'Coordination in progress',
    bullets:
      settlementReady || (releaseReady && !hasBlockers)
        ? [
            `${snapshot.summary.releaseReadyCount} participant${snapshot.summary.releaseReadyCount === 1 ? '' : 's'} ready for release`,
          ]
        : hasBlockers
          ? releaseBlockerSummaryLines(detailedBlockers)
          : releaseReady
            ? [`${snapshot.summary.releaseReadyCount} participant${snapshot.summary.releaseReadyCount === 1 ? '' : 's'} ready for release`]
            : ['Continue configuring participants and funding'],
  };

  const nextActions = detailedBlockers.slice(0, 4).map(actionFromDetail);
  const fundingBlocker = snapshot.funding.stage?.blockerLabel;

  if (typeof window === 'undefined') {
    assertGraphGuidanceInvariants({
      releaseReadyCount: snapshot.summary?.releaseReadyCount ?? 0,
      blockerCount: blockers.length,
      fundingBlocker,
      guidanceHeadline: readinessExplanation.headline,
    });
    assertSettlementReleaseInvariants({
      settlementReady,
      releaseBlocked: hasBlockers,
      releaseReadyCount: snapshot.summary.releaseReadyCount,
      guidanceHeadline: readinessExplanation.headline,
      fundingBlocker,
    });
  }

  return {
    blockers,
    detailedBlockers,
    warnings,
    nextActions,
    readinessExplanation,
    blockingLayer,
    releaseBlockedReason,
  };
}
