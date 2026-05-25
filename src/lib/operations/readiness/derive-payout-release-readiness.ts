import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { OperationalBlockerDetail } from '@/lib/operations/contracts/approval-state';
import {
  deriveAgreementApprovalState,
  deriveOperationalBlocker,
  deriveObligationApprovalState,
  obligationApprovalLabel,
} from '@/lib/operations/derivations/derive-approval-state';
import { deriveCurrencyConsistencyWarnings } from '@/lib/operations/derivations/derive-currency-consistency';
import type { CatalogItemRef } from '@/lib/operations/derivations/commission-scope';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';
import {
  normalizeParticipantEntity,
  deriveParticipantCapabilityFlags,
} from '@/lib/operations/guards/hydration-guards';
import { deriveParticipantCapabilityFlags } from '@/lib/operations/guards/hydration-guards';
import type { OperationalReadinessResult } from '@/lib/operations/types/readiness-result';
import { emptyReadiness } from '@/lib/operations/types/readiness-result';

export type PayoutReleaseReadiness = OperationalReadinessResult & {
  participantId: string;
  releaseReady: boolean;
  agreementApproved: boolean;
  operatorConfirmed: boolean;
  attributionEligible: boolean;
  operationalBlockers: OperationalBlockerDetail[];
  primaryBlocker: OperationalBlockerDetail | null;
};

export type PayoutReleaseContext = {
  projectId?: string;
  obligationStatus?: string;
  fundingAllocated?: boolean;
  catalogItems?: CatalogItemRef[];
  projectCurrency?: string;
  serviceCurrencies?: string[];
};

/**
 * Canonical payout release readiness — single derivation for all payout surfaces.
 */
export function derivePayoutReleaseReadiness(
  participant: DemoParticipant,
  context: PayoutReleaseContext = {}
): PayoutReleaseReadiness {
  const p = normalizeParticipantEntity(participant);
  const flags = deriveParticipantCapabilityFlags(p);
  const agreementState = deriveAgreementApprovalState(p);
  const agreementApproved =
    agreementState === 'participant_approved' || agreementState === 'fully_approved';
  const operatorConfirmed =
    p.compensationProfile?.exemptFromPayout === true ||
    p.payoutVerificationConfirmed === true;
  const attributionEligible = canGenerateAttributionLink(p, {
    catalogItems: context.catalogItems,
  });

  const operationalBlockers = deriveOperationalBlocker(p, context.projectId);
  const obligationBlockers: string[] = [];

  if (context.obligationStatus) {
    const obligationApproval = deriveObligationApprovalState({
      obligationStatus: context.obligationStatus,
      participant: p,
    });
    if (obligationApproval !== 'ready') {
      obligationBlockers.push(obligationApprovalLabel(obligationApproval, p));
    }
  }

  if (context.fundingAllocated === false) {
    obligationBlockers.push('Funding not yet reserved against obligations');
  }

  const currencyWarnings = deriveCurrencyConsistencyWarnings({
    projectCurrency: context.projectCurrency,
    serviceCurrencies: context.serviceCurrencies,
  });
  const currencyBlockers = currencyWarnings
    .filter((w) => w.severity === 'blocking')
    .map((w) => w.message);

  const blockers = [
    ...operationalBlockers.map((b) => b.explanation),
    ...obligationBlockers,
    ...currencyBlockers,
  ];

  const releaseReady =
    flags.payoutReady &&
    operationalBlockers.length === 0 &&
    obligationBlockers.length === 0 &&
    currencyBlockers.length === 0;

  const readinessLevel = releaseReady
    ? 'ready'
    : blockers.length > 0
      ? 'blocked'
      : 'partial';

  return {
    participantId: p.id,
    releaseReady,
    agreementApproved,
    operatorConfirmed,
    attributionEligible,
    operationalBlockers,
    primaryBlocker: operationalBlockers[0] ?? null,
    readinessScore: releaseReady ? 100 : Math.max(10, 100 - blockers.length * 15),
    readinessLevel,
    blockers,
    warnings: [],
    missingRequirements: blockers,
    nextRecommendedActions: [],
    needsGuidance: !releaseReady,
  };
}

export function derivePayoutReleaseReadinessBatch(
  participants: DemoParticipant[],
  context: Omit<PayoutReleaseContext, 'catalogItems'> & {
    catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
  } = {}
): PayoutReleaseReadiness[] {
  return participants.map((p) =>
    derivePayoutReleaseReadiness(p, {
      ...context,
      catalogItems: context.catalogItemsByParticipant?.[p.id],
    })
  );
}

export function countReleaseReadyParticipants(
  participants: DemoParticipant[],
  context: Omit<PayoutReleaseContext, 'catalogItems'> & {
    catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
  } = {}
): number {
  return derivePayoutReleaseReadinessBatch(participants, context).filter((r) => r.releaseReady)
    .length;
}

export function emptyPayoutReleaseReadiness(
  overrides: Partial<PayoutReleaseReadiness> = {}
): PayoutReleaseReadiness {
  return {
    ...emptyReadiness({ blockers: ['Participant unavailable'] }),
    participantId: 'unknown',
    releaseReady: false,
    agreementApproved: false,
    operatorConfirmed: false,
    attributionEligible: false,
    operationalBlockers: [],
    primaryBlocker: null,
    ...overrides,
  };
}
