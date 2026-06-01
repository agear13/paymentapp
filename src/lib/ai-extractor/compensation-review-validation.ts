import type { ExtractedParty } from '@/lib/ai-extractor/extraction-types';
import type { ReviewedParty } from '@/lib/ai-extractor/review-form-types';

export type CompensationReviewWarningKind =
  | 'revenue_share_missing_pct'
  | 'fixed_payout_missing_amount'
  | 'hybrid_incomplete';

export type CompensationReviewWarning = {
  kind: CompensationReviewWarningKind;
  title: string;
  message: string;
};

export type CompensationReviewValidationIssue = {
  partyId: string;
  partyName: string;
  warnings: CompensationReviewWarning[];
  blockSaveMessage: string;
};

function isPositiveNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

export function revenueComponentActive(party: ReviewedParty, original?: ExtractedParty): boolean {
  if (party.participationModel === 'revenue_share') return true;
  if (party.revenueSharePct != null) return true;
  if (original?.participationModel.value === 'revenue_share') return true;
  return original?.revenueSharePct.value != null;
}

export function fixedComponentActive(party: ReviewedParty, original?: ExtractedParty): boolean {
  if (party.participationModel === 'fixed_payout') return true;
  if (party.fixedAmount != null) return true;
  if (original?.participationModel.value === 'fixed_payout') return true;
  return original?.fixedAmount.value != null;
}

function attributionComponentActive(party: ReviewedParty, original?: ExtractedParty): boolean {
  if (party.participationModel === 'customer_attribution') return true;
  return original?.participationModel.value === 'customer_attribution';
}

/** Two or more compensation component types detected for the same party. */
export function isHybridCompensationParty(
  party: ReviewedParty,
  original?: ExtractedParty
): boolean {
  const revenue = revenueComponentActive(party, original);
  const fixed = fixedComponentActive(party, original);
  const attribution = attributionComponentActive(party, original);

  if (revenue && fixed) return true;
  if (attribution && revenue) return true;
  if (attribution && fixed) return true;
  return false;
}

export function isRevenueSharePctComplete(party: ReviewedParty): boolean {
  return isPositiveNumber(party.revenueSharePct);
}

export function isFixedPayoutAmountComplete(party: ReviewedParty): boolean {
  return isPositiveNumber(party.fixedAmount);
}

export function getPartyCompensationWarnings(
  party: ReviewedParty,
  original?: ExtractedParty
): CompensationReviewWarning[] {
  if (!party.name.trim()) return [];

  if (isHybridCompensationParty(party, original)) {
    const missing: string[] = [];
    if (revenueComponentActive(party, original) && !isRevenueSharePctComplete(party)) {
      missing.push('revenue share percentage');
    }
    if (fixedComponentActive(party, original) && !isFixedPayoutAmountComplete(party)) {
      missing.push('fixed payment amount');
    }
    if (missing.length > 0) {
      return [
        {
          kind: 'hybrid_incomplete',
          title: 'Hybrid compensation detected',
          message: 'One or more compensation components are missing. Complete all earnings terms before saving.',
        },
      ];
    }
    return [];
  }

  if (party.participationModel === 'revenue_share' && !isRevenueSharePctComplete(party)) {
    return [
      {
        kind: 'revenue_share_missing_pct',
        title: 'Revenue share detected',
        message: 'Percentage not found in conversation. Enter a percentage before saving.',
      },
    ];
  }

  if (party.participationModel === 'fixed_payout' && !isFixedPayoutAmountComplete(party)) {
    return [
      {
        kind: 'fixed_payout_missing_amount',
        title: 'Fixed payment detected',
        message: 'Payment amount not found in conversation. Enter an amount before saving.',
      },
    ];
  }

  return [];
}

export function reviewedPartyFromExtracted(original: ExtractedParty): ReviewedParty {
  return {
    id: original.id,
    name: original.name.value,
    email: original.email.value ?? '',
    role: original.role.value,
    participationModel: original.participationModel.value,
    fixedAmount: original.fixedAmount.value,
    revenueSharePct: original.revenueSharePct.value,
    notes: original.notes.value ?? '',
  };
}

/** True when the AI extraction alone had incomplete commercial terms. */
export function wasExtractedCompensationIncomplete(
  original: ExtractedParty
): boolean {
  return getPartyCompensationWarnings(reviewedPartyFromExtracted(original), original).length > 0;
}

export function describeExtractedCompensationGap(
  original: ExtractedParty
): string | null {
  const reviewed = reviewedPartyFromExtracted(original);
  const name = reviewed.name.trim() || 'Participant';
  const warnings = getPartyCompensationWarnings(reviewed, original);
  if (warnings.length === 0) return null;

  if (warnings[0]?.kind === 'hybrid_incomplete') {
    return `Hybrid compensation detected for ${name} but one or more components were not found in the source conversation.`;
  }
  if (warnings[0]?.kind === 'revenue_share_missing_pct') {
    return `Revenue share detected for ${name} but no percentage was found in the source conversation.`;
  }
  if (warnings[0]?.kind === 'fixed_payout_missing_amount') {
    return `Fixed payment detected for ${name} but no amount was found in the source conversation.`;
  }
  return null;
}

export function validateReviewFormCompensation(
  parties: ReviewedParty[],
  originalsById: Map<string, ExtractedParty> = new Map()
): CompensationReviewValidationIssue[] {
  const issues: CompensationReviewValidationIssue[] = [];

  for (const party of parties) {
    if (!party.name.trim()) continue;
    const original = originalsById.get(party.id);
    const warnings = getPartyCompensationWarnings(party, original);
    if (warnings.length === 0) continue;

    const partyName = party.name.trim();
    issues.push({
      partyId: party.id,
      partyName,
      warnings,
      blockSaveMessage: `${partyName}: ${warnings[0]!.message}`,
    });
  }

  return issues;
}
