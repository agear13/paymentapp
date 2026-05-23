import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommissionSource } from '@/lib/operations/contracts/participant-contract';
import {
  deriveCommissionScope,
  type CatalogItemRef,
  type CommissionScopeContext,
  type CommissionSettlementBasis,
} from '@/lib/operations/derivations/commission-scope';
import { safeCompensationState } from '@/lib/operations/guards/hydration-guards';
import type { ParticipantCompensationType } from '@/lib/participants/participant-compensation-types';

export type DerivedCompensationState = {
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
  earningsSecondary: string;
  earningsTitle: string;
  eligibleCatalogItems: CatalogItemRef[];
  earningsSummary: string;
  storageState: ReturnType<typeof safeCompensationState>;
};

/** Pure compensation operational state — no UI logic. */
export function deriveCompensationState(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): DerivedCompensationState {
  const profile = participant.compensationProfile;
  const storageState = safeCompensationState(participant);
  const configured = profile?.configured === true || storageState === 'CONFIGURED';
  const exemptFromPayout = profile?.exemptFromPayout === true;
  const scope = deriveCommissionScope(participant, context);

  return {
    configured,
    type: profile?.compensationType ?? null,
    exemptFromPayout,
    attributionEnabled: profile?.customerAttributionEnabled === true,
    commissionSource: profile?.commissionSourceMode ?? 'all_active',
    selectedCatalogItemIds: profile?.commissionServiceIds ?? [],
    settlementBasis: scope.settlementBasis,
    scopeLabel: scope.scopeLabel,
    scopeDescription: scope.scopeDescription,
    earningsPrimary: scope.earningsPrimary,
    earningsSecondary: scope.earningsSecondary,
    earningsTitle: scope.earningsTitle,
    eligibleCatalogItems: scope.eligibleCatalogItems,
    earningsSummary: scope.earningsPrimary,
    storageState,
  };
}
