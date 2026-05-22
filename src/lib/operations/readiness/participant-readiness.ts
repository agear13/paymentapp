import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveParticipantCapabilityFlags,
  deriveParticipantState,
  normalizeParticipantEntity,
} from '@/lib/operations/guards/hydration-guards';
import { deriveCompensationReadiness } from '@/lib/operations/readiness/compensation-readiness';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';
import type { ParticipantState } from '@/lib/operations/states/participant-state';

export type ParticipantPayoutReadiness = OperationalReadinessResult & {
  participantId: string;
  name: string;
  state: ParticipantState;
  flags: ReturnType<typeof deriveParticipantCapabilityFlags>;
  primaryIssue: string | null;
  /** Canonical payout gate — same as flags.payoutReady */
  payoutReady: boolean;
  /** Human-readable gaps (alias of blockers for legacy callers) */
  issues: string[];
  /** @deprecated use payoutReady */ isPayoutReady: boolean;
  /** @deprecated use issues */ readinessReasons: string[];
};

export function deriveParticipantPayoutReadiness(
  participant: DemoParticipant | null | undefined,
  context?: { providerConnected?: boolean; obligationsLinked?: boolean }
): ParticipantPayoutReadiness {
  try {
    const p = normalizeParticipantEntity(participant);
    const flags = deriveParticipantCapabilityFlags(p);
    const state = deriveParticipantState(p);
    const comp = deriveCompensationReadiness(p);
    const issues: string[] = [...comp.missingRequirements];

    if (!flags.hasPayoutDestination) {
      if (!p.email?.trim()) issues.push('No payout destination configured');
      else if (!flags.hasAgreement) issues.push('Payout onboarding incomplete');
    }
    if (!flags.hasAgreement && !p.compensationProfile?.exemptFromPayout) {
      issues.push('Agreement not approved');
    }
    if (context?.obligationsLinked === false) {
      issues.push('Obligations not linked');
    }

    const payoutReady = flags.payoutReady;
    const readinessLevel = payoutReady
      ? 'ready'
      : issues.length > 0
        ? 'partial'
        : 'none';
    const score = payoutReady ? 100 : Math.max(10, 100 - issues.length * 20);

    return {
      participantId: p.id,
      name: p.name,
      state,
      flags,
      readinessScore: score,
      readinessLevel,
      blockers: issues,
      warnings: [],
      missingRequirements: issues,
      nextRecommendedActions: [],
      needsGuidance: !payoutReady,
      primaryIssue: issues[0] ?? null,
      payoutReady,
      issues,
      isPayoutReady: payoutReady,
      readinessReasons: issues,
    };
  } catch {
    return {
      ...emptyReadiness({
        blockers: ['Compensation structure missing'],
        missingRequirements: ['Compensation structure missing'],
      }),
      participantId: 'unknown',
      name: 'Participant',
      state: 'COMPENSATION_PENDING',
      flags: {
        hasIdentity: false,
        hasCompensation: false,
        hasPayoutDestination: false,
        hasAgreement: false,
        payoutReady: false,
      },
      primaryIssue: 'Compensation structure missing',
      payoutReady: false,
      issues: ['Compensation structure missing'],
      isPayoutReady: false,
      readinessReasons: ['Compensation structure missing'],
    };
  }
}

export function countPayoutReadyParticipants(
  participants: DemoParticipant[]
): number {
  return participants.filter((p) => deriveParticipantPayoutReadiness(p).payoutReady).length;
}

export type ProjectReadinessGapSummary = {
  missingCompensation: number;
  missingPayoutDestinations: number;
  missingCompliance: number;
  payoutReadyCount: number;
  total: number;
  gapLabels: string[];
};

export function summarizeProjectReadinessGaps(
  participants: DemoParticipant[]
): ProjectReadinessGapSummary {
  const snapshots = participants.map((p) => deriveParticipantPayoutReadiness(p));
  let missingCompensation = 0;
  let missingPayoutDestinations = 0;
  let missingCompliance = 0;
  let payoutReadyCount = 0;

  for (const s of snapshots) {
    if (s.payoutReady) payoutReadyCount += 1;
    if (
      s.issues.some(
        (r) =>
          r.includes('Compensation') ||
          r.includes('Revenue share') ||
          r.includes('reimbursement')
      )
    ) {
      missingCompensation += 1;
    }
    if (
      s.issues.some((r) => r.includes('Payout destination') || r.includes('onboarding'))
    ) {
      missingPayoutDestinations += 1;
    }
    if (s.issues.some((r) => r.includes('Agreement'))) {
      missingCompliance += 1;
    }
  }

  const gapLabels: string[] = [];
  if (missingCompensation > 0) gapLabels.push('Compensation structures');
  if (missingPayoutDestinations > 0) gapLabels.push('Payout destinations');
  if (missingCompliance > 0) gapLabels.push('Compliance details');

  return {
    missingCompensation,
    missingPayoutDestinations,
    missingCompliance,
    payoutReadyCount,
    total: participants.length,
    gapLabels,
  };
}
