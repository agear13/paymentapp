import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { AgreementLifecycleState } from '@/lib/operations/lifecycle/agreement-lifecycle';
import type { AttributionLifecycleState } from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { ParticipantLifecycleState } from '@/lib/operations/lifecycle/participant-lifecycle';
import type { PayoutOnboardingPhase } from '@/lib/operations/lifecycle/payout-lifecycle';
import type { ParticipantCompensationType } from '@/lib/participants/participant-compensation-types';
import type { OperationalAttributionContract } from '@/lib/operations/contracts/attribution-contract';
import type { CommissionSettlementBasis, CatalogItemRef } from '@/lib/operations/derivations/commission-scope';

export type CommissionSource = 'all_active' | 'selected';

export type PayoutVerificationLifecycle = PayoutOnboardingPhase;

export type OperationalEntitySource = 'draft' | 'hydrated' | 'legacy';

/**
 * Canonical operational participant contract.
 * Presentation components must consume this — not raw DB/storage records.
 */
export type HydratedParticipant = {
  id: string;

  identity: {
    displayName: string;
    email: string | null;
    role: string;
  };

  lifecycle: {
    participant: ParticipantLifecycleState;
    agreement: AgreementLifecycleState;
    attribution: AttributionLifecycleState;
    payoutVerification: PayoutVerificationLifecycle;
  };

  compensation: {
    configured: boolean;
    type: ParticipantCompensationType | null;
    exemptFromPayout: boolean;
    attributionEnabled: boolean;
    commissionSource: CommissionSource;
    selectedCatalogItemIds: string[];
    settlementBasis: CommissionSettlementBasis;
    scopeLabel: string;
    scopeDescription: string;
    earningsPrimary: string;
    earningsPrimaryCompact: string;
    earningsSecondary: string;
    earningsTitle: string;
    eligibleCatalogItems: CatalogItemRef[];
    /** @deprecated use earningsPrimaryCompact in dense table surfaces */
    earningsSummary: string;
  };

  payout: {
    verifiedExternally: boolean;
    verifiedAt: string | null;
    blocked: boolean;
  };

  attribution: OperationalAttributionContract;

  operational: {
    payoutReady: boolean;
    agreementReady: boolean;
    needsAttention: boolean;
  };

  metadata: {
    contractVersion: typeof PARTICIPANT_CONTRACT_VERSION;
    source: OperationalEntitySource;
    createdAt?: string;
    updatedAt?: string;
  };

  /**
   * Hydrated storage entity for mutations only (save, invite, share).
   * Presentation must not derive operational truth from this field.
   */
  _entity: DemoParticipant;
};

export const PARTICIPANT_CONTRACT_VERSION = 1 as const;
