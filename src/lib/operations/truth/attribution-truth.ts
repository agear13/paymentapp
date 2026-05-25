import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  ATTRIBUTION_DISABLED_COPY,
  deriveAttributionLifecycleState,
} from '@/lib/operations/lifecycle/attribution-lifecycle';
import type { CatalogItemRef, CommissionScopeContext } from '@/lib/operations/truth/attribution-eligibility';
import {
  canGenerateAttributionLink,
  hasEligibleCatalogItems,
  isAttributionEnabled,
  shouldIssueAttributionForParticipant,
} from '@/lib/operations/truth/attribution-eligibility';
import {
  deriveCommissionEligibleCatalogItems,
  isAllActiveCatalogSource,
  isCatalogScopedCommission,
} from '@/lib/operations/derivations/commission-scope';
import { normalizeParticipantEntity } from '@/lib/operations/guards/hydration-guards';

export type AttributionExplanation =
  | 'inactive'
  | 'active_all_catalog'
  | 'active_selected_catalog'
  | 'awaiting_catalog_assignment'
  | 'unavailable_compensation_model'
  | 'awaiting_approval';

export {
  canGenerateAttributionLink,
  shouldIssueAttributionForParticipant,
  isAttributionEnabled,
  hasEligibleCatalogItems,
};

export function isAttributionOperationallyEnabled(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  if (!canGenerateAttributionLink(participant, context)) return false;
  const state = deriveAttributionLifecycleState(participant, context);
  return state === 'ACTIVE' || state === 'LINK_GENERATED';
}

export function isAttributionActiveForTracking(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): boolean {
  if (!canGenerateAttributionLink(participant, context)) return false;
  return (
    participant.approvalStatus === 'Approved' &&
    (participant.attributionStatus === 'active' ||
      Boolean(participant.customerCommerceUrl?.trim()))
  );
}

export function deriveAttributionExplanation(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): {
  kind: AttributionExplanation;
  label: string;
  detail: string;
} {
  const p = normalizeParticipantEntity(participant);

  if (!isAttributionEnabled(p)) {
    return {
      kind: 'inactive',
      label: 'Attribution inactive',
      detail: ATTRIBUTION_DISABLED_COPY,
    };
  }

  if (!isCatalogScopedCommission(p)) {
    return {
      kind: 'unavailable_compensation_model',
      label: 'Attribution unavailable for this compensation model',
      detail: 'Customer attribution links apply only to catalog commission earnings.',
    };
  }

  const eligible = isAllActiveCatalogSource(p)
    ? (context.catalogItems ?? [])
    : deriveCommissionEligibleCatalogItems(p, context);

  if (eligible.length === 0) {
    return {
      kind: 'awaiting_catalog_assignment',
      label: 'Attribution configured but awaiting eligible catalog assignment',
      detail: 'Assign qualifying catalog items before customer links can be issued.',
    };
  }

  if (p.approvalStatus !== 'Approved') {
    return {
      kind: 'awaiting_approval',
      label: 'Attribution eligible — pending agreement approval',
      detail: 'Customer attribution activates after the participant approves their agreement.',
    };
  }

  if (isAllActiveCatalogSource(p)) {
    return {
      kind: 'active_all_catalog',
      label: 'Attribution active for all catalog items',
      detail: formatCatalogNames(eligible, 'all active catalog items'),
    };
  }

  return {
    kind: 'active_selected_catalog',
    label: 'Attribution active for selected catalog items',
    detail: formatCatalogNames(eligible, 'selected catalog items'),
  };
}

function formatCatalogNames(items: CatalogItemRef[], fallback: string): string {
  if (items.length === 0) return fallback;
  if (items.length === 1) return `Qualifying purchases: ${items[0].name}`;
  if (items.length <= 3) return `Qualifying purchases: ${items.map((i) => i.name).join(', ')}`;
  return `Qualifying purchases: ${items
    .slice(0, 2)
    .map((i) => i.name)
    .join(', ')} +${items.length - 2} more`;
}

export function attributionTruthLabel(
  participant: DemoParticipant,
  context: CommissionScopeContext = {}
): string {
  return deriveAttributionExplanation(participant, context).label;
}

export { ATTRIBUTION_DISABLED_COPY };
