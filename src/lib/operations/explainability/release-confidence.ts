import { resolveAnyRailConfigured } from '@/lib/onboarding/workspace-activation-state';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { ReleaseConfidenceLevel } from '@/lib/operations/explainability/types';
import {
  countPayoutReadyParticipants,
  summarizeProjectReadinessGaps,
} from '@/lib/operations/readiness/participant-readiness';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';
import { resolveOperationalWorkspaceCurrency } from '@/lib/currency/resolve-operational-workspace-currency';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';

export type ReleaseConfidenceInput = {
  workspace: WorkspaceOperationalContext;
  participants?: DemoParticipant[];
  treasury?: ProjectTreasurySummary | null;
  currency?: string;
};

function scoreToLevel(score: number, blocked: boolean): ReleaseConfidenceLevel {
  if (blocked) return 'BLOCKED';
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

/**
 * Release confidence — explainable preview before release creation.
 * Does NOT execute payout logic or alter settlement math.
 */
export function deriveReleaseConfidence(input: ReleaseConfidenceInput): ReleaseConfidenceSnapshot {
  const currency = resolveOperationalWorkspaceCurrency({
    projectCurrency: input.treasury?.currency ?? input.currency,
    workspaceDefaultCurrency: input.workspace.defaultCurrency,
  });
  const participants = input.participants ?? [];
  const gaps = summarizeProjectReadinessGaps(participants);
  const payoutReady = countPayoutReadyParticipants(participants);
  const total = participants.length;

  const collectedRevenue =
    (input.treasury?.confirmedFunding ?? 0) + (input.treasury?.clearedFunding ?? 0);
  const reservedObligations = input.treasury?.obligationsTotal ?? 0;
  const readyCount = input.treasury?.obligationsReady ?? input.workspace.releaseEligibleCount;
  const awaiting = input.treasury?.obligationsAwaitingFunding ?? 0;
  const totalOb = readyCount + awaiting || input.workspace.obligationCount;

  const readyToRelease =
    totalOb > 0 && reservedObligations > 0
      ? Math.round((readyCount / Math.max(totalOb, 1)) * reservedObligations)
      : readyCount > 0
        ? Math.min(collectedRevenue, reservedObligations)
        : 0;

  const heldBack = Math.max(0, collectedRevenue - readyToRelease);
  const heldBackReasons: string[] = [];
  if (input.treasury?.pendingFunding && input.treasury.pendingFunding > 0) {
    heldBackReasons.push(
      `${currency} ${formatAmount(input.treasury.pendingFunding)} revenue pending settlement`
    );
  }
  if (gaps.missingCompensation > 0) {
    heldBackReasons.push(
      `${gaps.missingCompensation} participant${gaps.missingCompensation === 1 ? '' : 's'} missing compensation configuration`
    );
  }
  if (gaps.missingPayoutDestinations > 0) {
    heldBackReasons.push(
      `${gaps.missingPayoutDestinations} participant${gaps.missingPayoutDestinations === 1 ? '' : 's'} missing payout destination`
    );
  }
  if (awaiting > 0) {
    heldBackReasons.push(`${awaiting} obligation${awaiting === 1 ? '' : 's'} awaiting funding`);
  }
  if (heldBackReasons.length === 0 && heldBack > 0) {
    heldBackReasons.push('Funds reserved until obligations are approved and funded');
  }

  const riskWarnings: string[] = [];
  if (!resolveAnyRailConfigured(input.workspace)) {
    riskWarnings.push('No payment provider connected');
  }
  if (input.treasury?.projectHealth === 'settlement_risk') {
    riskWarnings.push('Settlement risk detected in treasury health');
  }
  if (input.treasury?.forecastFunding && input.treasury.forecastFunding > input.treasury.confirmedFunding) {
    riskWarnings.push('Forecast revenue exceeds confirmed funding');
  }

  const providerOk =
    input.workspace.stripeConfigured ||
    input.workspace.wiseConfigured ||
    input.workspace.hederaConfigured;
  const participantsOk = total === 0 || payoutReady === total;
  const compensationOk =
    input.workspace.participantCount === 0 ||
    input.workspace.participantsConfiguredCount >= input.workspace.participantCount;

  let score = 0;
  if (providerOk) score += 25;
  if (compensationOk) score += 25;
  if (collectedRevenue > 0) score += 20;
  if (readyCount > 0) score += 15;
  if (participantsOk && total > 0) score += 15;

  const blocked =
    !providerOk ||
    !compensationOk ||
    (total > 0 && payoutReady === 0) ||
    input.workspace.releaseEligibleCount === 0;

  const level = scoreToLevel(score, blocked);

  const explainHeadline =
    level === 'BLOCKED'
      ? 'Release blocked — resolve blockers before creating a payout batch'
      : level === 'HIGH'
        ? 'Release confidence is high — review held-back amounts before confirming'
        : level === 'MEDIUM'
          ? 'Release possible with caution — some funds or participants remain incomplete'
          : 'Release confidence is low — funding or participant setup incomplete';

  const bullets: string[] = [];
  if (readyCount > 0 && totalOb > 0) {
    bullets.push(`${readyCount} of ${totalOb} obligations releasable`);
  } else if (input.workspace.obligationCount === 0) {
    bullets.push('No obligations tracked yet');
  }
  if (gaps.missingCompensation > 0) {
    bullets.push(`${gaps.missingCompensation} participant${gaps.missingCompensation === 1 ? '' : 's'} missing earnings configuration`);
  }
  if (gaps.missingPayoutDestinations > 0) {
    bullets.push(`${gaps.missingPayoutDestinations} participant${gaps.missingPayoutDestinations === 1 ? '' : 's'} missing payout setup`);
  }
  if (awaiting > 0) {
    bullets.push(`${awaiting} obligation${awaiting === 1 ? '' : 's'} awaiting funding`);
  }
  if (level === 'HIGH' && bullets.length === 0) {
    bullets.push('Funding, participants, and obligations align for release review');
  }

  return {
    level,
    score,
    currency,
    collectedRevenue,
    reservedObligations,
    readyToRelease,
    heldBack,
    heldBackReasons,
    blockedParticipantCount: total - payoutReady,
    riskWarnings,
    releasableObligationCount: readyCount,
    totalObligationCount: totalOb,
    explainability: { headline: explainHeadline, bullets },
  };
}

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
