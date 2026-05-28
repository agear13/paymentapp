import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionEligibleCatalogItems,
  deriveCommissionScope,
  type CatalogItemRef,
} from '@/lib/operations/derivations/commission-scope';
import { canGenerateAttributionLink } from '@/lib/operations/truth/attribution-truth';
import type {
  CanonicalAttributionRecord,
  CanonicalOperationalState,
} from '@/lib/operations/reducer/types';

export type AttributionServiceScope = {
  participantId: string;
  scopeDefined: boolean;
  activated: boolean;
  eligibleServices: CatalogItemRef[];
  scopeLabel: string;
  scopeDescription: string;
  earningsPrimary: string;
};

/** Agreement projection must consume ONLY this selector for eligible services. */
export function deriveAttributionServiceScopeFromState(
  state: CanonicalOperationalState,
  participantId: string,
  catalogItems: CatalogItemRef[] = []
): AttributionServiceScope {
  const row =
    state.attribution.find((a) => a.participantId === participantId) ??
    buildAttributionFromParticipant(
      state.participants.find((p) => p.participantId === participantId)?.entity,
      catalogItems
    );

  const participant = state.participants.find((p) => p.participantId === participantId)?.entity;
  const scope = participant
    ? deriveCommissionScope(participant, { catalogItems })
    : {
        scopeLabel: 'Attribution not configured',
        scopeDescription: 'Configure participant earnings to define attribution scope.',
        earningsPrimary: '—',
      };

  return {
    participantId,
    scopeDefined: row?.scopeDefined ?? false,
    activated: row?.activated ?? false,
    eligibleServices: row?.eligibleServices ?? [],
    scopeLabel: scope.scopeLabel,
    scopeDescription: scope.scopeDescription,
    earningsPrimary: scope.earningsPrimary,
  };
}

function buildAttributionFromParticipant(
  participant: DemoParticipant | undefined,
  catalogItems: CatalogItemRef[]
): CanonicalAttributionRecord | null {
  if (!participant) return null;
  const eligibleServices = deriveCommissionEligibleCatalogItems(participant, { catalogItems });
  const activated = canGenerateAttributionLink(participant, { catalogItems });
  const scopeDefined =
    participant.compensationProfile?.customerAttributionEnabled === true ||
    eligibleServices.length > 0;

  return {
    participantId: participant.id,
    scopeDefined,
    activated,
    eligibleServiceIds: eligibleServices.map((s) => s.id),
    eligibleServices,
  };
}

export function deriveAllAttributionScopesFromState(
  state: CanonicalOperationalState,
  catalogItemsByParticipant: Record<string, CatalogItemRef[]> = {}
): CanonicalAttributionRecord[] {
  return state.participants.map((row) => {
    const catalogItems = catalogItemsByParticipant[row.participantId] ?? [];
    return (
      buildAttributionFromParticipant(row.entity, catalogItems) ?? {
        participantId: row.participantId,
        scopeDefined: false,
        activated: false,
        eligibleServiceIds: [],
        eligibleServices: [],
      }
    );
  });
}
