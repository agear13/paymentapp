import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  deriveCommissionEligibleCatalogItems,
  isAllActiveCatalogSource,
  isCatalogScopedCommission,
  type CatalogItemRef,
  type CommissionScopeContext,
} from '@/lib/operations/derivations/commission-scope';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';

export type { CatalogItemRef, CommissionScopeContext };

export function isAttributionEnabled(participant: DemoParticipant): boolean {
  const p = normalizeParticipantEntity(participant);
  return (
    p.compensationProfile?.customerAttributionEnabled === true ||
    p.participationModel === 'customer_attribution'
  );
}

export function hasEligibleCatalogItems(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  if (!isCatalogScopedCommission(participant)) return false;
  if (isAllActiveCatalogSource(participant)) {
    return (context.catalogItems?.length ?? 0) > 0;
  }
  return deriveCommissionEligibleCatalogItems(participant, context).length > 0;
}

/**
 * Strict attribution link gate — link/QR ONLY when:
 * attribution enabled + catalog commission + eligible catalog items exist.
 */
export function canGenerateAttributionLink(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  const p = normalizeParticipantEntity(participant);
  if (!isAttributionEnabled(p)) return false;
  if (!isCatalogScopedCommission(p)) return false;
  if (p.referralCommerce?.createReferralLink === false) return false;
  return hasEligibleCatalogItems(p, context);
}

export function shouldIssueAttributionForParticipant(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  return canGenerateAttributionLink(participant, context);
}
