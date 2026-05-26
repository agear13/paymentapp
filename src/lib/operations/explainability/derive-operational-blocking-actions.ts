import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import type { OperationalCoordinationSnapshot } from '@/lib/operations/selectors/operational-coordination-snapshot';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import {
  assertGraphGuidanceInvariants,
  type GraphGuidanceInvariantInput,
} from '@/lib/operations/dev/operational-invariants';

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
  warnings: string[];
  nextActions: OperationalBlockingAction[];
  readinessExplanation: { headline: string; bullets: string[] };
  blockingLayer: string | null;
  releaseBlockedReason: string | null;
};

function blockerFromDetail(detail: OperationalBlockerDetail): OperationalBlockingCause {
  return {
    code: detail.id,
    explanation: detail.explanation,
    layer: detail.owner === 'participant' ? 'participant' : 'coordination',
    severity: detail.severity === 'blocking' ? 'blocking' : 'warning',
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

/**
 * Canonical blocker/action derivation — all guidance surfaces must consume this output.
 */
export function deriveOperationalBlockingActions(
  snapshot: OperationalCoordinationSnapshot,
  workspace?: WorkspaceOperationalContext
): OperationalBlockingActionsResult {
  const causes: OperationalBlockingCause[] = [];

  const fundingBlocker = snapshot.funding.stage?.blockerLabel;
  if (fundingBlocker) {
    causes.push({
      code: 'funding_coordination',
      explanation: fundingBlocker,
      layer: 'funding',
      severity: 'blocking',
    });
  }

  for (const p of snapshot.participants) {
    const participantId = p.participant?.id ?? 'unknown';
    for (const b of p.readinessHierarchy?.participant?.blockers ?? []) {
      causes.push({
        code: `participant-${participantId}`,
        explanation: b,
        layer: 'participant',
        severity: 'blocking',
      });
    }
    for (const b of p.readinessHierarchy?.obligation?.blockers ?? []) {
      causes.push({
        code: `obligation-${participantId}`,
        explanation: b,
        layer: 'obligation',
        severity: 'blocking',
      });
    }
    for (const b of p.readinessHierarchy?.funding?.blockers ?? []) {
      causes.push({
        code: `funding-${participantId}`,
        explanation: b,
        layer: 'funding',
        severity: 'blocking',
      });
    }
    for (const b of p.readinessHierarchy?.release?.blockers ?? []) {
      causes.push({
        code: `release-${participantId}`,
        explanation: b,
        layer: 'release',
        severity: 'blocking',
      });
    }
    for (const detail of p.blockers ?? []) {
      causes.push(blockerFromDetail(detail));
    }
  }

  for (const detail of snapshot.summary.allBlockers) {
    causes.push(blockerFromDetail(detail));
  }

  const blockers = uniqueBlockers(causes.filter((c) => c.severity === 'blocking'));
  const warnings = uniqueBlockers(causes.filter((c) => c.severity === 'warning')).map(
    (c) => c.explanation
  );

  const releaseReady = snapshot.summary.releaseReadyCount > 0;
  const hasBlockers = blockers.length > 0;
  const blockingLayer = hasBlockers ? blockers[0]?.layer ?? null : null;
  const releaseBlockedReason = hasBlockers ? blockers[0]?.explanation ?? null : null;

  const readinessExplanation = {
    headline: hasBlockers
      ? 'Release blocked because:'
      : releaseReady
        ? 'Ready for payout release'
        : 'Coordination in progress',
    bullets: hasBlockers
      ? blockers.map((b) => b.explanation)
      : releaseReady
        ? [`${snapshot.summary.releaseReadyCount} participant${snapshot.summary.releaseReadyCount === 1 ? '' : 's'} ready for release`]
        : ['Continue configuring participants and funding'],
  };

  const nextActions: OperationalBlockingAction[] = [];
  if (fundingBlocker?.includes('reserved')) {
    nextActions.push({
      id: 'reserve-funding',
      title: 'Reserve funding against obligations',
      description: fundingBlocker,
      ctaLabel: 'Review funding',
    });
  } else if (fundingBlocker) {
    nextActions.push({
      id: 'resolve-funding',
      title: 'Resolve funding coordination',
      description: fundingBlocker,
      ctaLabel: 'Review funding',
    });
  }

  if (workspace && workspace.participantCount > workspace.participantsConfiguredCount) {
    nextActions.push({
      id: 'configure-earnings',
      title: 'Configure participant earnings',
      description: `${workspace.participantCount - workspace.participantsConfiguredCount} participant(s) need earnings configuration`,
      ctaLabel: 'Configure earnings',
    });
  }

  if (typeof window === 'undefined') {
    assertGraphGuidanceInvariants({
      releaseReadyCount: snapshot.summary?.releaseReadyCount ?? 0,
      blockerCount: blockers.length,
      fundingBlocker,
      guidanceHeadline: readinessExplanation.headline,
    });
  }

  return {
    blockers,
    warnings,
    nextActions,
    readinessExplanation,
    blockingLayer,
    releaseBlockedReason,
  };
}
