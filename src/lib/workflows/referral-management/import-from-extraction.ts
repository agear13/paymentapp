/**
 * Thin adapter: map existing AI Extractor results into Referral Management
 * review candidates. Persistence is performed by a caller-supplied function;
 * this module does not write participants itself.
 */

import type { ExtractedParty, ExtractionResult } from '@/lib/ai-extractor/extraction-types';
import { hasFixedFeeAmount, hasRevenueSharePct } from '@/lib/ai-extractor/party-obligation-metrics';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import type {
  WorkflowCoordinationAgreementStatus,
  WorkflowCoordinationNextActionKind,
  WorkflowCoordinationPayoutStatus,
  WorkflowCoordinationReferralStatus,
} from '@/lib/workflows/agreement-intelligence/types';
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

export type ReferralExtractionCoordination = {
  nextActionKind?: WorkflowCoordinationNextActionKind | null;
  nextActionLabel?: string | null;
  agreementStatus?: WorkflowCoordinationAgreementStatus | null;
  payoutSetupStatus?: WorkflowCoordinationPayoutStatus | null;
  referralStatus?: WorkflowCoordinationReferralStatus | null;
  statusLabel?: string | null;
};

export const NEW_PROMOTER_EXTRACTION_STATUS = 'Awaiting approval';

export type ReferralExtractionSuccessSummary = {
  participantId: string;
  participantName: string;
  commission: string;
  eligibleServices: string[];
  status: string;
  nextStep: string | null;
  inviteActionLabel: string | null;
};

export function referralExtractionNextStep(
  name: string,
  coordination?: ReferralExtractionCoordination | null
): string | null {
  const participant = name.trim() || 'this promoter';
  switch (coordination?.nextActionKind) {
    case 'request_approval':
      if (coordination.agreementStatus === 'requested' || coordination.agreementStatus === 'viewed') {
        return `Wait for ${participant} to review and approve their agreement.`;
      }
      return `${participant} needs to review and approve their agreement before their referral can be activated.`;
    case 'request_payout_details':
      if (coordination.payoutSetupStatus === 'requested') {
        return `Wait for ${participant} to submit their payout details.`;
      }
      return `Request payout details from ${participant}.`;
    case 'review_payout_details':
      return `Review the payout details ${participant} submitted.`;
    case 'request_update':
      return `Ask ${participant} to update their payout details.`;
    case 'activate_referral':
      if (coordination.referralStatus === 'service_required') {
        return `Select an eligible service before activating ${participant}'s referral.`;
      }
      return `Activate ${participant}'s referral so they can start referring.`;
    case 'none':
      return null;
    default:
      return coordination?.nextActionLabel?.trim() || null;
  }
}

export function referralExtractionStatusLabel(
  coordination?: ReferralExtractionCoordination | null
): string {
  if (coordination?.agreementStatus === 'approved') {
    return coordination.statusLabel?.trim() || 'Approved';
  }
  if (coordination?.agreementStatus === 'requested' || coordination?.agreementStatus === 'viewed') {
    return 'Invitation sent';
  }
  if (coordination?.agreementStatus === 'not_requested' || !coordination?.agreementStatus) {
    return NEW_PROMOTER_EXTRACTION_STATUS;
  }
  return coordination.statusLabel?.trim() || NEW_PROMOTER_EXTRACTION_STATUS;
}

export function selectedReferralCandidates(
  preview: ReferralImportPreview
): ReferralImportCandidate[] {
  const selected = preview.candidates.filter((row) => row.selected);
  if (selected.length > 0) return selected;
  if (preview.candidates.length === 1 && preview.candidates[0]) return [preview.candidates[0]];
  return [];
}

export function buildReferralExtractionSuccessSummary(input: {
  candidate: ReferralImportCandidate;
  catalog: ReferralCatalogItem[];
  participantId: string;
  status?: string | null;
  coordination?: ReferralExtractionCoordination | null;
}): ReferralExtractionSuccessSummary {
  const catalogName = input.candidate.serviceId
    ? input.catalog.find((item) => item.id === input.candidate.serviceId)?.name?.trim()
    : null;
  const extractedLabel = input.candidate.extractedServiceLabel?.trim() || null;
  const eligibleServices = catalogName
    ? [catalogName]
    : extractedLabel
      ? [extractedLabel]
      : [];
  const participantName = input.candidate.name.trim() || 'Participant';
  const coordination = input.coordination ?? {
    nextActionKind: 'request_approval',
    agreementStatus: 'not_requested',
    statusLabel: input.status,
  };

  const canInvite =
    coordination.nextActionKind === 'request_approval' &&
    coordination.agreementStatus !== 'requested' &&
    coordination.agreementStatus !== 'viewed';

  return {
    participantId: input.participantId,
    participantName,
    commission: input.candidate.commissionLabel.trim() || 'Commission not specified',
    eligibleServices,
    status: input.status?.trim() || referralExtractionStatusLabel(coordination),
    nextStep: referralExtractionNextStep(participantName, coordination),
    inviteActionLabel: canInvite ? `Send ${participantName} an invitation →` : null,
  };
}

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

export function resolvePersistedPromoterId(result: {
  ok: boolean;
  participantId?: string | null;
  existing?: { participantId?: string | null } | null;
}): string | null {
  const id = (result.participantId ?? result.existing?.participantId ?? '').trim();
  if (!id) return null;
  if (!result.ok && !result.existing) return null;
  return id;
}

export function referralManagementParticipantHref(participantId: string): string {
  return COMMERCIAL_OS_ROUTES.workflowParticipant('referral-management', participantId);
}

export function canPersistReferralPreview(
  preview: ReferralImportPreview
): { ok: true } | { ok: false; error: string } {
  const selected = selectedReferralCandidates(preview);
  if (selected.length === 0) {
    return {
      ok: false,
      error:
        preview.candidates.length === 0
          ? 'No referral or commission relationship was found in this conversation.'
          : 'Select at least one referral relationship to add.',
    };
  }
  for (const candidate of selected) {
    const mapped = candidateToPromoterInput(candidate);
    if ('error' in mapped) return { ok: false, error: mapped.error };
  }
  return { ok: true };
}

export async function persistSelectedReferralCandidates(input: {
  preview: ReferralImportPreview;
  persist: (body: {
    name: string;
    email: string;
    phone?: string;
    role: ReferralPromoterRole;
    compensation: ReferralCompensationInput;
    reuseExisting: true;
  }) => Promise<{
    ok: boolean;
    participantId?: string | null;
    existing?: { participantId?: string | null } | null;
    error?: string;
    coordination?: ReferralExtractionCoordination | null;
  }>;
}): Promise<
  | {
      ok: true;
      participantId: string;
      candidate: ReferralImportCandidate;
      coordination: ReferralExtractionCoordination | null;
    }
  | { ok: false; error: string }
> {
  const ready = canPersistReferralPreview(input.preview);
  if (!ready.ok) return ready;

  let last:
    | {
        participantId: string;
        candidate: ReferralImportCandidate;
        coordination: ReferralExtractionCoordination | null;
      }
    | null = null;

  for (const candidate of selectedReferralCandidates(input.preview)) {
    const mapped = candidateToPromoterInput(candidate);
    if ('error' in mapped) return { ok: false, error: mapped.error };
    const result = await input.persist({ ...mapped, reuseExisting: true });
    const participantId = resolvePersistedPromoterId(result);
    if (!participantId) {
      return { ok: false, error: result.error ?? 'Could not save the extracted participant.' };
    }
    last = {
      participantId,
      candidate,
      coordination: result.coordination ?? null,
    };
  }

  if (!last) return { ok: false, error: 'Could not save the extracted participant.' };
  return { ok: true, ...last };
}
