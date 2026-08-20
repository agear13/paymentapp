/**
 * Thin adapter: map existing AI Extractor results into Referral Management
 * review candidates. Does not persist participants or run extraction.
 */

import type { ExtractedParty, ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from '@/lib/ai-extractor/party-obligation-metrics';
import type { ReferralCompensationInput, ReferralPromoterRole } from '@/lib/workflows/referral-management/constants';

export type ReferralCatalogItem = { id: string; name: string };

export type ReferralServiceMatch = 'exact' | 'ambiguous' | 'none';

export type ReferralImportCandidate = {
  partyId: string;
  selected: boolean;
  name: string;
  email: string;
  phone: string;
  role: ReferralPromoterRole;
  extractedRole: string;
  compensationKind: 'revenue_share' | 'fixed';
  percentage: number | null;
  amount: number | null;
  currency: string;
  extractedServiceLabel: string | null;
  serviceId: string | null;
  serviceMatch: ReferralServiceMatch;
  serviceSuggestions: ReferralCatalogItem[];
  commissionLabel: string;
};

export type ReferralImportExcludedParty = {
  name: string;
  role: string;
  reason: string;
};

export type ReferralImportPreview = {
  sourceLabel: string;
  projectName: string | null;
  candidates: ReferralImportCandidate[];
  excludedParties: ReferralImportExcludedParty[];
};

const REFERRAL_ROLE = /promoter|affiliate|referr|partner/i;

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchOrganizationService(
  catalog: ReferralCatalogItem[],
  extractedLabel: string | null | undefined
): {
  serviceId: string | null;
  serviceMatch: ReferralServiceMatch;
  serviceSuggestions: ReferralCatalogItem[];
} {
  const needle = extractedLabel ? normalizeName(extractedLabel) : '';
  if (!needle) {
    return { serviceId: null, serviceMatch: 'none', serviceSuggestions: [] };
  }

  const exact = catalog.filter((item) => normalizeName(item.name) === needle);
  if (exact.length === 1) {
    return { serviceId: exact[0].id, serviceMatch: 'exact', serviceSuggestions: exact };
  }
  if (exact.length > 1) {
    return { serviceId: null, serviceMatch: 'ambiguous', serviceSuggestions: exact };
  }

  return { serviceId: null, serviceMatch: 'none', serviceSuggestions: [] };
}

export function isReferralRelationshipParty(party: ExtractedParty): boolean {
  const model = party.participationModel.value;
  if (model === 'revenue_share' || model === 'customer_attribution') return true;
  if (model === 'hybrid' && hasRevenueSharePct(party)) return true;
  if (hasRevenueSharePct(party) && model !== 'fixed_payout') return true;

  const terms = party.compensationTerms ?? [];
  if (terms.some((term) => term.type === 'revenue_share' || term.type === 'attribution')) {
    return true;
  }

  const referralRole = REFERRAL_ROLE.test(party.role.value ?? '');
  if (referralRole && (hasRevenueSharePct(party) || hasFixedFeeAmount(party) || model === 'fixed_payout')) {
    return true;
  }

  return false;
}

export function mapExtractedRole(role: string | null | undefined): ReferralPromoterRole {
  const value = (role ?? '').toLowerCase();
  if (value.includes('affiliate')) return 'Affiliate';
  if (value.includes('partner')) return 'Partner';
  if (value.includes('promoter') || value.includes('referr')) return 'Promoter';
  return 'Other';
}

function extractedServiceLabel(party: ExtractedParty, projectName: string | null): string | null {
  const deliverable = party.deliverables.find((item) => item.description.value.trim())?.description.value.trim();
  if (deliverable) return deliverable;
  const legacy = party.deliverablesLegacy?.value?.find((item) => item.trim())?.trim();
  if (legacy) return legacy;
  return projectName?.trim() || null;
}

function compensationFromParty(
  party: ExtractedParty,
  currency: string
): Pick<
  ReferralImportCandidate,
  'compensationKind' | 'percentage' | 'amount' | 'currency' | 'commissionLabel'
> {
  const shareTerm = (party.compensationTerms ?? []).find(
    (term) => term.type === 'revenue_share' || term.type === 'attribution'
  );
  const percentage =
    party.revenueSharePct.value && party.revenueSharePct.value > 0
      ? party.revenueSharePct.value
      : shareTerm?.percentage.value && shareTerm.percentage.value > 0
        ? shareTerm.percentage.value
        : null;

  if (
    percentage != null ||
    party.participationModel.value === 'revenue_share' ||
    party.participationModel.value === 'customer_attribution' ||
    party.participationModel.value === 'hybrid'
  ) {
    const pct = percentage ?? 0;
    return {
      compensationKind: 'revenue_share',
      percentage: pct > 0 ? pct : null,
      amount: null,
      currency,
      commissionLabel: pct > 0 ? `${pct}% revenue share` : 'Revenue share',
    };
  }

  const amount = party.fixedAmount.value && party.fixedAmount.value > 0 ? party.fixedAmount.value : null;
  return {
    compensationKind: 'fixed',
    percentage: null,
    amount,
    currency,
    commissionLabel: amount != null ? `${currency} ${amount} fixed commission` : 'Fixed commission',
  };
}

export function mapExtractionToReferralPreview(input: {
  extraction: ExtractionResult;
  catalog: ReferralCatalogItem[];
  sourceLabel: string;
}): ReferralImportPreview {
  const projectName = input.extraction.projectName.value?.trim() || null;
  const currency = (input.extraction.currency.value || 'AUD').toUpperCase().slice(0, 3);
  const candidates: ReferralImportCandidate[] = [];
  const excludedParties: ReferralImportExcludedParty[] = [];

  for (const party of input.extraction.parties) {
    const name = party.name.value.trim();
    if (!name) continue;

    if (!isReferralRelationshipParty(party)) {
      excludedParties.push({
        name,
        role: party.role.value?.trim() || 'Party',
        reason: 'Contractual party — not a referral/commission relationship',
      });
      continue;
    }

    const serviceLabel = extractedServiceLabel(party, projectName);
    const matched = matchOrganizationService(input.catalog, serviceLabel);
    const compensation = compensationFromParty(party, currency || 'AUD');

    candidates.push({
      partyId: party.id,
      selected: false,
      name,
      email: party.email.value?.trim() ?? '',
      phone: '',
      role: mapExtractedRole(party.role.value),
      extractedRole: party.role.value?.trim() || 'Promoter / Referrer',
      ...compensation,
      extractedServiceLabel: serviceLabel,
      serviceId: matched.serviceId,
      serviceMatch: matched.serviceMatch,
      serviceSuggestions: matched.serviceSuggestions,
      commissionLabel: compensation.commissionLabel,
    });
  }

  if (candidates.length === 1 && candidates[0]) {
    candidates[0].selected = true;
  }

  return {
    sourceLabel: input.sourceLabel,
    projectName,
    candidates,
    excludedParties,
  };
}

export function candidateToPromoterInput(candidate: ReferralImportCandidate): {
  name: string;
  email: string;
  phone?: string;
  role: ReferralPromoterRole;
  compensation: ReferralCompensationInput;
} | { error: string } {
  const name = candidate.name.trim();
  const email = candidate.email.trim();
  if (!name) return { error: 'Promoter name is required.' };
  if (!email) return { error: 'Email is required before this referral relationship can be created.' };
  if (!candidate.serviceId) {
    return { error: 'Select an existing catalogue service. A service will not be invented.' };
  }

  if (candidate.compensationKind === 'revenue_share') {
    const percentage = Number(candidate.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return { error: 'Enter a revenue-share percentage between 0 and 100.' };
    }
    return {
      name,
      email,
      phone: candidate.phone.trim() || undefined,
      role: candidate.role,
      compensation: { kind: 'revenue_share', percentage, serviceId: candidate.serviceId },
    };
  }

  const amount = Number(candidate.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Enter a fixed commission amount.' };
  }
  return {
    name,
    email,
    phone: candidate.phone.trim() || undefined,
    role: candidate.role,
    compensation: {
      kind: 'fixed',
      amount,
      currency: candidate.currency || 'AUD',
      serviceId: candidate.serviceId,
    },
  };
}
