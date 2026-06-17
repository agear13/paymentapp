import type { ExtractedParty, ExtractionResult } from './extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from './party-obligation-metrics';
import { deliverableDescriptions } from './parse-deliverables';

export const AGREEMENT_TYPES = [
  'MULTI_PARTY_EVENT_COORDINATION',
  'EVENT_REVENUE_SHARE',
  'FIXED_FEE_SERVICE',
  'CUSTOMER_ATTRIBUTION',
  'OTHER',
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

const DISPLAY_LABELS: Record<AgreementType, string> = {
  MULTI_PARTY_EVENT_COORDINATION: 'Multi-Party Event Coordination Agreement',
  EVENT_REVENUE_SHARE: 'Event Revenue Share Agreement',
  FIXED_FEE_SERVICE: 'Fixed Fee Service Agreement',
  CUSTOMER_ATTRIBUTION: 'Customer Attribution Agreement',
  OTHER: 'Collaboration Agreement',
};

export function agreementTypeDisplayLabel(type: AgreementType): string {
  return DISPLAY_LABELS[type];
}

function hasEventContext(result: ExtractionResult): boolean {
  const text = [
    result.projectName.value,
    result.projectDescription.value,
    result.counterparty.value,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /event|session|festival|concert|gig|show|night|party/.test(text);
}

function countDeliverables(parties: ExtractedParty[]): number {
  return parties.reduce((sum, party) => sum + deliverableDescriptions(party).length, 0);
}

export function classifyAgreementType(result: ExtractionResult): AgreementType {
  const parties = result.parties;
  const participantCount = parties.length;
  const revenueShareCount = parties.filter((p) => hasRevenueSharePct(p)).length;
  const fixedFeeCount = parties.filter((p) => hasFixedFeeAmount(p)).length;
  const attributionCount = parties.filter(
    (p) => p.participationModel.value === 'customer_attribution'
  ).length;
  const deliverableCount = countDeliverables(parties);
  const eventContext = hasEventContext(result);

  if (attributionCount > 0 && revenueShareCount === 0 && fixedFeeCount === 0) {
    return 'CUSTOMER_ATTRIBUTION';
  }

  if (participantCount >= 3 && eventContext && (revenueShareCount >= 2 || deliverableCount >= 3)) {
    if (revenueShareCount >= 2 && fixedFeeCount >= 1) {
      return 'MULTI_PARTY_EVENT_COORDINATION';
    }
    if (revenueShareCount >= 2) {
      return 'EVENT_REVENUE_SHARE';
    }
    return 'MULTI_PARTY_EVENT_COORDINATION';
  }

  if (revenueShareCount >= 2 && eventContext) {
    return 'EVENT_REVENUE_SHARE';
  }

  if (fixedFeeCount > 0 && revenueShareCount === 0) {
    return 'FIXED_FEE_SERVICE';
  }

  if (participantCount >= 3) {
    return 'MULTI_PARTY_EVENT_COORDINATION';
  }

  return 'OTHER';
}
