import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommissionSource } from '@/lib/operations/contracts/participant-contract';
import { safeCompensationState } from '@/lib/operations/guards/hydration-guards';
import type { ParticipantCompensationType } from '@/lib/participants/participant-compensation-types';
import { earningsStructureSummary } from '@/lib/projects/participant-entitlement';

export type DerivedCompensationState = {
  configured: boolean;
  type: ParticipantCompensationType | null;
  exemptFromPayout: boolean;
  attributionEnabled: boolean;
  commissionSource: CommissionSource;
  selectedCatalogItemIds: string[];
  earningsSummary: string;
  storageState: ReturnType<typeof safeCompensationState>;
};

/** Pure compensation operational state — no UI logic. */
export function deriveCompensationState(participant: DemoParticipant): DerivedCompensationState {
  const profile = participant.compensationProfile;
  const storageState = safeCompensationState(participant);
  const configured = profile?.configured === true || storageState === 'CONFIGURED';
  const exemptFromPayout = profile?.exemptFromPayout === true;

  return {
    configured,
    type: profile?.compensationType ?? null,
    exemptFromPayout,
    attributionEnabled: profile?.customerAttributionEnabled === true,
    commissionSource: profile?.commissionSourceMode ?? 'all_active',
    selectedCatalogItemIds: profile?.commissionServiceIds ?? [],
    earningsSummary: earningsStructureSummary(participant),
    storageState,
  };
}
