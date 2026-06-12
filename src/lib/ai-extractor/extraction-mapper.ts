import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { buildProjectParticipant, participationModelToCommissionKind } from '@/lib/projects/participant-entitlement';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import type { OperationalParticipantRole } from '@/lib/projects/participants-for-project';
import type { ReviewFormState, ReviewedParty } from './review-form-types';
import { EXTRACTOR_VERSION, EXTRACTOR_CREATED_VIA, SOURCE_TYPE_LABELS } from './extraction-types';
import type { ExtractedParty } from './extraction-types';
import type { ConversationImportAuditRecord } from '@/lib/operations/audit/conversation-import-audit-types';
import { appendConversationImportToDeal } from '@/lib/operations/audit/conversation-import-audit';
import {
  attributionComponentActive,
  isHybridCompensationParty,
  isFixedPayoutAmountComplete,
  isRevenueSharePctComplete,
} from '@/lib/ai-extractor/compensation-review-validation';

// Normalised role string → OperationalParticipantRole. Unknown strings fall back to 'Contributor'.
const ROLE_NORMALISATION_MAP: Record<string, OperationalParticipantRole> = {
  partner: 'Partner',
  'co-founder': 'Co-founder',
  cofounder: 'Co-founder',
  'co founder': 'Co-founder',
  stakeholder: 'Stakeholder',
  investor: 'Stakeholder',
  backer: 'Stakeholder',
  contractor: 'Contractor',
  freelancer: 'Contractor',
  developer: 'Contractor',
  designer: 'Contractor',
  dj: 'Contractor',
  performer: 'Contractor',
  artist: 'Contractor',
  supplier: 'Contractor',
  vendor: 'Contractor',
  referrer: 'Referrer',
  introducer: 'Referrer',
  agent: 'Referrer',
  broker: 'Referrer',
  affiliate: 'Referrer',
  promoter: 'Referrer',
  contributor: 'Contributor',
  helper: 'Contributor',
  staff: 'Contributor',
};

export function mapRoleStringToOperationalRole(raw: string): OperationalParticipantRole {
  const normalised = raw.toLowerCase().trim();
  return ROLE_NORMALISATION_MAP[normalised] ?? 'Contributor';
}

/** Exposed for compensation pipeline tracing only — same logic as import save path. */
export function traceBuildCompensationProfileFromReview(
  party: ReviewedParty,
  original?: ExtractedParty
): ParticipantCompensationProfile | undefined {
  return buildCompensationProfileFromReview(party, original);
}

function buildCompensationProfileFromReview(
  party: ReviewedParty,
  original?: ExtractedParty
): ParticipantCompensationProfile | undefined {
  const configuredAt = new Date().toISOString();

  if (isHybridCompensationParty(party, original)) {
    if (!isRevenueSharePctComplete(party) || !isFixedPayoutAmountComplete(party)) {
      return undefined;
    }
    const attribution = attributionComponentActive(party, original);
    return {
      compensationType: 'HYBRID',
      percentage: party.revenueSharePct!,
      fixedAmount: party.fixedAmount!,
      customerAttributionEnabled: attribution,
      configured: true,
      configuredAt,
    };
  }

  if (party.participationModel === 'revenue_share' && isRevenueSharePctComplete(party)) {
    return {
      compensationType: 'REVENUE_SHARE',
      percentage: party.revenueSharePct!,
      configured: true,
      configuredAt,
    };
  }

  if (party.participationModel === 'fixed_payout' && isFixedPayoutAmountComplete(party)) {
    return {
      compensationType: 'FIXED_FEE',
      fixedAmount: party.fixedAmount!,
      configured: true,
      configuredAt,
    };
  }

  if (
    party.participationModel === 'customer_attribution' ||
    attributionComponentActive(party, original)
  ) {
    const pct = party.revenueSharePct ?? original?.revenueSharePct.value ?? null;
    if (pct != null && Number.isFinite(pct) && pct > 0) {
      return {
        compensationType: 'COMMISSION',
        percentage: pct,
        customerAttributionEnabled: true,
        configured: true,
        configuredAt,
      };
    }
    return {
      compensationType: 'COMMISSION',
      customerAttributionEnabled: true,
      configured: true,
      configuredAt,
    };
  }

  return undefined;
}

/**
 * Build a RecentDeal from the operator-reviewed extraction form state.
 * Called only for Entry Point A (new project from conversation).
 * The returned deal is a draft — status 'Pending', paymentStatus 'Not Paid'.
 */
export function mapReviewToRecentDeal(
  review: ReviewFormState,
  importRecord?: ConversationImportAuditRecord
): RecentDeal {
  const id = `demo-${Date.now()}`;
  const primaryParty = review.parties[0];

  // projectValueCurrency is strictly 'AUD' | 'USD' in the existing system.
  // Any other extracted currency (IDR, SGD, etc.) falls back to 'AUD'.
  const projectValueCurrency =
    review.currency === 'AUD' || review.currency === 'USD' ? review.currency : 'AUD';

  const base: RecentDeal = {
    id,
    dealName: review.projectName.trim() || 'Untitled Project',
    partner: review.counterparty?.trim() || primaryParty?.name?.trim() || '',
    value: review.projectValue ?? 0,
    introducer: '',
    closer: '',
    status: 'Pending',
    lastUpdated: new Date().toISOString(),
    payoutTrigger: 'Manual',
    paymentStatus: 'Not Paid',
    projectDescription: review.projectDescription?.trim() || undefined,
    projectValueCurrency,
    archived: false,
    createdVia: EXTRACTOR_CREATED_VIA,
    extractorVersion: EXTRACTOR_VERSION,
    sourceType: SOURCE_TYPE_LABELS[review.sourceType] ?? review.sourceType,
    importedConversation: review.rawConversationText,
    importedAt: importRecord?.importedAt ?? new Date().toISOString(),
  };

  return importRecord ? appendConversationImportToDeal(base, importRecord) : base;
}

/**
 * Build a DemoParticipant from a single reviewed party and the deal it belongs to.
 * Exported so the review modal can call it per-party with party.id still in scope,
 * avoiding any name-based reconnection between built participants and their source parties.
 */
export function mapSinglePartyToParticipant(
  party: ReviewedParty,
  project: RecentDeal,
  provenanceTag: string,
  original?: ExtractedParty
): DemoParticipant {
  const role = mapRoleStringToOperationalRole(party.role);
  const hybrid = isHybridCompensationParty(party, original);
  const mappedParticipationModel =
    hybrid || party.participationModel === 'hybrid' ? 'revenue_share' : party.participationModel;
  const commissionKind = participationModelToCommissionKind(mappedParticipationModel);
  const commissionValue =
    party.participationModel === 'fixed_payout' && !hybrid
      ? (party.fixedAmount ?? 0)
      : (party.revenueSharePct ?? 0);

  const noteParts: string[] = [provenanceTag];
  if (party.notes.trim()) noteParts.push(party.notes.trim());
  const participantNotes = noteParts.join(' | ');

  const built = buildProjectParticipant({
    name: party.name.trim(),
    email: party.email.trim() || undefined,
    role,
    project,
    notes: participantNotes,
    participationModel:
      hybrid || party.participationModel === 'hybrid' ? 'revenue_share' : party.participationModel,
    commissionKind,
    commissionValue,
    enableCustomerAttribution:
      party.participationModel === 'customer_attribution' ||
      attributionComponentActive(party, original),
  });

  const profile = buildCompensationProfileFromReview(party, original);
  return profile ? applyCompensationProfileToParticipant(built, profile) : built;
}

/**
 * Merge AI-extracted compensation onto an existing participant without overwriting
 * lifecycle identity (id, inviteToken, approval/agreement state).
 */
export function mergeExtractedCompensationIntoExistingParticipant(
  existing: DemoParticipant,
  built: DemoParticipant
): DemoParticipant {
  const base: DemoParticipant = {
    ...existing,
    participantNotes: built.participantNotes,
  };
  if (built.compensationProfile) {
    return applyCompensationProfileToParticipant(base, built.compensationProfile);
  }
  return {
    ...base,
    commissionKind: built.commissionKind,
    commissionValue: built.commissionValue,
    participationModel: built.participationModel,
  };
}

/**
 * Build all DemoParticipants from the operator-reviewed extraction form state.
 * Works for all three entry points — the caller supplies the correct project object
 * (newly created for Entry Point A, fetched from snapshot for B and C).
 */
export function mapReviewToParticipants(
  review: ReviewFormState,
  project: RecentDeal,
  originalsById?: Map<string, ExtractedParty>
): DemoParticipant[] {
  const provenanceTag = `[AI Import: ${SOURCE_TYPE_LABELS[review.sourceType] ?? review.sourceType} · ${EXTRACTOR_VERSION}]`;

  return review.parties
    .filter((p) => p.name.trim().length > 0)
    .map((party) =>
      mapSinglePartyToParticipant(party, project, provenanceTag, originalsById?.get(party.id))
    );
}
