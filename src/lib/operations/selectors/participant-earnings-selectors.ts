import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionScope,
  type CatalogItemRef,
  type CommissionScopeContext,
} from '@/lib/operations/derivations/commission-scope';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';
import {
  isCompensationExempt,
  inferCompensationConfiguredFromPersistence,
} from '@/lib/participants/participant-compensation';
import { isParticipantOperationallyApproved } from '@/lib/operations/truth/participant-truth';
import { isAttributionActiveForTracking } from '@/lib/operations/truth/attribution-truth';

/**
 * Canonical earnings-configured gate — all surfaces must use this selector only.
 * Derives from persisted participant entity fields after operational hydration.
 */
export function isParticipantEarningsConfigured(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  const entity = normalizeParticipantEntity(participant);
  if (isCompensationExempt(entity)) return true;
  return inferCompensationConfiguredFromPersistence(entity);
}

/** True when commercial terms (scope/pricing copy) would render for this participant. */
export function participantRendersCommercialTerms(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  const scope = deriveCommissionScope(normalizeParticipantEntity(participant), context);
  return scope.settlementBasis !== 'not_configured';
}

/**
 * Canonical payout-ready KPI — matches reducer KPI semantics (persisted entities only).
 */
export function isParticipantPayoutReadyForKpi(
  participant: DemoParticipant | null | undefined
): boolean {
  if (!participant) return false;
  const entity = normalizeParticipantEntity(participant);
  if (!isParticipantEarningsConfigured(entity)) return false;
  if (!isParticipantOperationallyApproved(entity)) return false;
  if (entity.compensationProfile?.exemptFromPayout) return true;
  return entity.payoutVerificationConfirmed === true;
}

/** Attribution active for operational KPIs — configured + approved + link/trackable. */
export function isParticipantAttributionActive(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  if (!isParticipantEarningsConfigured(participant)) return false;
  return isAttributionActiveForTracking(participant, context);
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
  return participants.filter((p) => isParticipantEarningsConfigured(p)).length;
}

export function countParticipantsPayoutReadyForKpi(
  participants: DemoParticipant[]
): number {
  return participants.filter((p) => isParticipantPayoutReadyForKpi(p)).length;
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
