import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionScope,
  type CatalogItemRef,
  type CommissionScopeContext,
} from '@/lib/operations/derivations/commission-scope';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';
import {
  countPersistedEarningsConfigured,
  countPersistedPayoutReadyForKpi,
  hasActiveAttributionTracking,
  hasPersistedAttributionLinkEligibility,
  hasPersistedCompensationTerms,
  hasPersistedPayoutReadyForKpi,
  isParticipantCompensationExempt,
} from '@/lib/operations/primitives/participant-earnings-primitives';

/**
 * Canonical earnings-configured gate — top-layer selector composing persisted primitives.
 * UI, lifecycle, and diagnostics should import this; truth/derivations/hydration use primitives only.
 */
export function isParticipantEarningsConfigured(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  const entity = normalizeParticipantEntity(participant);
  if (isParticipantCompensationExempt(entity)) return true;
  return hasPersistedCompensationTerms(entity);
}

/** True when commercial terms (scope/pricing copy) would render for this participant. */
export function participantRendersCommercialTerms(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  const scope = deriveCommissionScope(normalizeParticipantEntity(participant), context);
  return scope.settlementBasis !== 'not_configured';
}

/** Canonical payout-ready KPI — matches reducer KPI semantics (persisted entities only). */
export function isParticipantPayoutReadyForKpi(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  return hasPersistedPayoutReadyForKpi(normalizeParticipantEntity(participant));
}

/** Attribution active for operational KPIs — configured + approved + link/trackable. */
export function isParticipantAttributionActive(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  const entity = normalizeParticipantEntity(participant);
  if (!hasPersistedCompensationTerms(entity) && !isParticipantCompensationExempt(entity)) {
    return false;
  }
  return hasActiveAttributionTracking(entity, {
    catalogItems: context.catalogItems,
  });
}

/** Participant may appear in release/obligations releasable counts. */
export function isParticipantObligationReleasable(
  participant: DemoParticipant,
  context: { releaseReady?: boolean } = {}
): boolean {
  return context.releaseReady === true;
}

export function countParticipantsEarningsConfigured(
  participants: DemoParticipant[]
): number {
  return countPersistedEarningsConfigured(participants);
}

export function countParticipantsPayoutReadyForKpi(
  participants: DemoParticipant[]
): number {
  return countPersistedPayoutReadyForKpi(participants);
}

export function countParticipantsAttributionActive(
  participants: DemoParticipant[],
  context: CommissionScopeContext & {
    catalogItemsByParticipant?: Record<string, CatalogItemRef[]>;
  } = {}
): number {
  return participants.filter((p) => {
    const catalogItems = context.catalogItemsByParticipant?.[p.id];
    return isParticipantAttributionActive(p, { ...context, catalogItems });
  }).length;
}

/** Re-export primitive for diagnostics comparing link eligibility without selector cycles. */
export { hasPersistedAttributionLinkEligibility };
