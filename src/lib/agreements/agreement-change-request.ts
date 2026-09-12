/**
 * Affiliate-suggested agreement corrections.
 *
 * Affiliates propose changes. Operators approve or reject. Approved changes
 * update the underlying participant/commercial relationship and issue a new
 * agreement version — they never silently mutate a signed record.
 */

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  audienceDiscountPctFromParticipant,
  currentAgreementVersion,
  formatAttributionLabel,
  formatCommissionLabel,
  formatCommissionType,
  formatEarningSourceLabel,
  phoneFromParticipant,
} from '@/lib/agreements/agreement-presentation';
import { parseAttributionMethod } from '@/lib/workflows/referral-management/earning-source';

export const AGREEMENT_CHANGE_FIELD_KEYS = [
  'legal_name',
  'email',
  'phone',
  'company_name',
  'role',
  'commission_rate',
  'commission_type',
  'earning_source',
  'referral_terms',
  'discount_terms',
] as const;

export type AgreementChangeFieldKey = (typeof AGREEMENT_CHANGE_FIELD_KEYS)[number];

export const AGREEMENT_CHANGE_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'superseded',
  'cancelled',
  'clarification_requested',
] as const;

export type AgreementChangeRequestStatus = (typeof AGREEMENT_CHANGE_REQUEST_STATUSES)[number];

export type AgreementChangeClassification = 'administrative' | 'commercial';

export type AgreementChangeFieldDefinition = {
  key: AgreementChangeFieldKey;
  label: string;
  classification: AgreementChangeClassification;
};

export const AGREEMENT_CHANGE_FIELDS: readonly AgreementChangeFieldDefinition[] = [
  { key: 'legal_name', label: 'Name', classification: 'administrative' },
  { key: 'email', label: 'Email', classification: 'administrative' },
  { key: 'phone', label: 'Phone', classification: 'administrative' },
  { key: 'company_name', label: 'Organisation / company', classification: 'administrative' },
  { key: 'role', label: 'Role', classification: 'administrative' },
  { key: 'commission_rate', label: 'Commission rate', classification: 'commercial' },
  { key: 'commission_type', label: 'Commission type', classification: 'commercial' },
  { key: 'earning_source', label: 'Earning source', classification: 'commercial' },
  { key: 'referral_terms', label: 'Referral terms', classification: 'commercial' },
  { key: 'discount_terms', label: 'Audience discount / discount terms', classification: 'commercial' },
];

export type AgreementChangeRequest = {
  id: string;
  agreementId: string;
  agreementVersionId: string | null;
  agreementVersionNumber: number;
  participantId: string;
  fieldKey: AgreementChangeFieldKey;
  fieldLabel: string;
  previousValue: string;
  suggestedValue: string;
  reason: string;
  classification: AgreementChangeClassification;
  status: AgreementChangeRequestStatus;
  createdAt: string;
  suggestedByParticipantId: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  resultingAgreementVersionId?: string | null;
};

export type SubmitAgreementChangeInput = {
  fieldKey: string;
  suggestedValue: string;
  reason: string;
  requestId?: string;
  createdAt?: string;
};

export type SubmitAgreementChangeResult =
  | { ok: true; request: AgreementChangeRequest; duplicate: boolean; participant: DemoParticipant }
  | { ok: false; error: string; code: string };

const FIELD_BY_KEY = new Map(AGREEMENT_CHANGE_FIELDS.map((field) => [field.key, field]));

export function isAgreementChangeFieldKey(value: string): value is AgreementChangeFieldKey {
  return FIELD_BY_KEY.has(value as AgreementChangeFieldKey);
}

export function classificationForField(key: AgreementChangeFieldKey): AgreementChangeClassification {
  return FIELD_BY_KEY.get(key)?.classification ?? 'administrative';
}

export function agreementChangeRequestsOf(participant: DemoParticipant): AgreementChangeRequest[] {
  return Array.isArray(participant.agreementChangeRequests) ? participant.agreementChangeRequests : [];
}

export function pendingAgreementChangeRequests(participant: DemoParticipant): AgreementChangeRequest[] {
  return agreementChangeRequestsOf(participant).filter(
    (request) => request.status === 'pending' || request.status === 'clarification_requested'
  );
}

export function currentValueForChangeField(
  participant: DemoParticipant,
  fieldKey: AgreementChangeFieldKey
): string {
  switch (fieldKey) {
    case 'legal_name':
      return participant.name?.trim() || '';
    case 'email':
      return participant.email?.trim() || '';
    case 'phone':
      return phoneFromParticipant(participant);
    case 'company_name':
      return participant.companyName?.trim() || '';
    case 'role':
      return participant.roleLabel?.trim() || participant.role?.trim() || '';
    case 'commission_rate':
      return formatCommissionLabel(participant);
    case 'commission_type':
      return formatCommissionType(participant);
    case 'earning_source':
      return formatEarningSourceLabel(participant.earningSource);
    case 'referral_terms':
      return participant.agreementNotes?.trim() || participant.roleDetails?.trim() || '';
    case 'discount_terms':
      return formatAudienceDiscountLabelSafe(participant);
  }
}

function formatAudienceDiscountLabelSafe(participant: DemoParticipant): string {
  const pct = audienceDiscountPctFromParticipant(participant);
  if (pct == null) return '';
  return `${pct}%`;
}

function normalizeComparable(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findDuplicatePendingChange(
  participant: DemoParticipant,
  fieldKey: AgreementChangeFieldKey,
  suggestedValue: string
): AgreementChangeRequest | null {
  const suggested = normalizeComparable(suggestedValue);
  return (
    pendingAgreementChangeRequests(participant).find(
      (request) =>
        request.fieldKey === fieldKey && normalizeComparable(request.suggestedValue) === suggested
    ) ?? null
  );
}

export function submitAgreementChangeRequest(
  participant: DemoParticipant,
  input: SubmitAgreementChangeInput
): SubmitAgreementChangeResult {
  if (!isAgreementChangeFieldKey(input.fieldKey)) {
    return { ok: false, error: 'That field cannot be suggested for change.', code: 'INVALID_FIELD' };
  }
  const suggestedValue = input.suggestedValue.trim();
  const reason = input.reason.trim();
  if (!suggestedValue) {
    return { ok: false, error: 'Enter a suggested value.', code: 'INVALID_VALUE' };
  }
  if (!reason) {
    return { ok: false, error: 'Explain what needs changing.', code: 'INVALID_REASON' };
  }
  if (suggestedValue.length > 500) {
    return { ok: false, error: 'Suggested value is too long.', code: 'INVALID_VALUE' };
  }
  if (reason.length > 2000) {
    return { ok: false, error: 'Reason is too long.', code: 'INVALID_REASON' };
  }

  const previousValue = currentValueForChangeField(participant, input.fieldKey);
  if (normalizeComparable(previousValue) === normalizeComparable(suggestedValue)) {
    return {
      ok: false,
      error: 'Suggested value is the same as the current value.',
      code: 'NO_CHANGE',
    };
  }

  const duplicate = findDuplicatePendingChange(participant, input.fieldKey, suggestedValue);
  if (duplicate) {
    return { ok: true, request: duplicate, duplicate: true, participant };
  }

  const field = FIELD_BY_KEY.get(input.fieldKey)!;
  const version = currentAgreementVersion(participant);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const request: AgreementChangeRequest = {
    id: input.requestId ?? crypto.randomUUID(),
    agreementId: participant.id,
    agreementVersionId: version?.versionId ?? null,
    agreementVersionNumber: version?.versionNumber ?? 1,
    participantId: participant.id,
    fieldKey: input.fieldKey,
    fieldLabel: field.label,
    previousValue,
    suggestedValue,
    reason,
    classification: field.classification,
    status: 'pending',
    createdAt,
    suggestedByParticipantId: participant.id,
  };

  const requests = agreementChangeRequestsOf(participant).map((existing) =>
    existing.fieldKey === input.fieldKey &&
    (existing.status === 'pending' || existing.status === 'clarification_requested')
      ? { ...existing, status: 'superseded' as const, reviewedAt: createdAt }
      : existing
  );

  return {
    ok: true,
    request,
    duplicate: false,
    participant: {
      ...participant,
      agreementChangeRequests: [...requests, request],
    },
  };
}

export function applyApprovedChangeToParticipant(
  participant: DemoParticipant,
  request: AgreementChangeRequest
): DemoParticipant {
  const value = request.suggestedValue.trim();
  switch (request.fieldKey) {
    case 'legal_name':
      return { ...participant, name: value };
    case 'email':
      return { ...participant, email: value };
    case 'phone':
      return {
        ...participant,
        phone: value,
        participantNotes: mergePhoneNote(participant.participantNotes, value),
      };
    case 'company_name':
      return { ...participant, companyName: value };
    case 'role':
      return { ...participant, roleLabel: value };
    case 'commission_rate':
      return applyCommissionRate(participant, value);
    case 'commission_type':
      return applyCommissionType(participant, value);
    case 'earning_source':
      return applyEarningSource(participant, value);
    case 'referral_terms':
      return { ...participant, agreementNotes: value };
    case 'discount_terms':
      return applyAudienceDiscount(participant, value);
  }
}

function mergePhoneNote(existing: string | undefined, phone: string): string {
  const rest = (existing ?? '').replace(/phone:\s*.+/i, '').trim();
  return rest ? `${rest}\nPhone: ${phone}` : `Phone: ${phone}`;
}

function parsePercent(value: string): number | null {
  const match = value.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function applyCommissionRate(participant: DemoParticipant, value: string): DemoParticipant {
  const pct = parsePercent(value);
  if (pct == null) return participant;
  const profile = participant.compensationProfile;
  return {
    ...participant,
    commissionValue: pct,
    compensationProfile: profile
      ? {
          ...profile,
          percentage: pct,
          configured: true,
        }
      : {
          compensationType: 'REVENUE_SHARE',
          percentage: pct,
          configured: true,
          configuredAt: new Date().toISOString(),
        },
    referralCommerce: participant.referralCommerce
      ? { ...participant.referralCommerce, commerceCommissionPct: pct }
      : participant.referralCommerce,
  };
}

function applyCommissionType(participant: DemoParticipant, value: string): DemoParticipant {
  const normalized = value.trim().toLowerCase();
  const isFixed = /fixed/.test(normalized);
  const isRevenueShare = /revenue|share|%/.test(normalized);
  if (isFixed) {
    return {
      ...participant,
      participationModel: 'fixed_payout',
      commissionKind: 'fixed_amount',
      compensationProfile: {
        ...(participant.compensationProfile ?? {
          compensationType: 'FIXED_FEE',
          configured: true,
        }),
        compensationType: 'FIXED_FEE',
        configured: true,
      },
    };
  }
  if (isRevenueShare || normalized.includes('commission')) {
    return {
      ...participant,
      participationModel: 'revenue_share',
      commissionKind: 'pct_deal_value',
      compensationProfile: {
        ...(participant.compensationProfile ?? {
          compensationType: 'REVENUE_SHARE',
          configured: true,
        }),
        compensationType: /commission/.test(normalized) ? 'COMMISSION' : 'REVENUE_SHARE',
        configured: true,
      },
    };
  }
  return participant;
}

function applyEarningSource(participant: DemoParticipant, value: string): DemoParticipant {
  const existing = participant.earningSource;
  const attribution = parseAttributionMethod(value) ?? existing?.attributionMethod ?? null;
  const looksExternal = /external|weso|app store|marketplace|platform/i.test(value);
  if (looksExternal || existing?.type === 'external') {
    return {
      ...participant,
      earningSource: {
        type: 'external',
        catalogueServiceIds: [],
        externalProvider: existing?.externalProvider ?? null,
        externalService: existing?.externalService ?? null,
        attributionMethod: attribution,
        externalIdentifier: existing?.externalIdentifier ?? null,
        integration: existing?.integration ?? null,
        metadata: {
          ...(existing?.metadata ?? {}),
          providerLabel: value.replace(/external:\s*/i, '').trim() || existing?.metadata?.providerLabel,
        },
      },
    };
  }
  return {
    ...participant,
    earningSource: {
      type: 'internal_service',
      catalogueServiceIds: existing?.catalogueServiceIds ?? [],
    },
  };
}

function applyAudienceDiscount(participant: DemoParticipant, value: string): DemoParticipant {
  const pct = parsePercent(value);
  if (pct == null) {
    return { ...participant, audienceDiscountPct: undefined };
  }
  return {
    ...participant,
    audienceDiscountPct: pct,
    earningSource: participant.earningSource
      ? {
          ...participant.earningSource,
          metadata: {
            ...(participant.earningSource.metadata ?? {}),
            audienceDiscountPct: pct,
          },
        }
      : participant.earningSource,
  };
}

export function markChangeRequest(
  participant: DemoParticipant,
  requestId: string,
  patch: Partial<AgreementChangeRequest>
): { participant: DemoParticipant; request: AgreementChangeRequest | null } {
  let updated: AgreementChangeRequest | null = null;
  const requests = agreementChangeRequestsOf(participant).map((request) => {
    if (request.id !== requestId) return request;
    updated = { ...request, ...patch };
    return updated;
  });
  return {
    participant: { ...participant, agreementChangeRequests: requests },
    request: updated,
  };
}

export function cancelPendingChangeRequests(
  participant: DemoParticipant,
  exceptId?: string,
  reviewedAt = new Date().toISOString()
): DemoParticipant {
  return {
    ...participant,
    agreementChangeRequests: agreementChangeRequestsOf(participant).map((request) =>
      request.id !== exceptId && (request.status === 'pending' || request.status === 'clarification_requested')
        ? { ...request, status: 'cancelled', reviewedAt }
        : request
    ),
  };
}

export function summarizePendingChangeRequests(participant: DemoParticipant): AgreementChangeRequest[] {
  return pendingAgreementChangeRequests(participant);
}

export type SerializedAgreementChangeRequest = {
  id: string;
  fieldLabel: string;
  previousValue: string;
  suggestedValue: string;
  reason: string;
  classification: AgreementChangeClassification;
  createdAt: string;
  agreementVersionNumber: number;
  status: string;
  reviewNote?: string | null;
};

export function serializePendingChangeRequests(
  participant: DemoParticipant
): SerializedAgreementChangeRequest[] {
  return pendingAgreementChangeRequests(participant).map((request) => ({
    id: request.id,
    fieldLabel: request.fieldLabel,
    previousValue: request.previousValue,
    suggestedValue: request.suggestedValue,
    reason: request.reason,
    classification: request.classification,
    createdAt: request.createdAt,
    agreementVersionNumber: request.agreementVersionNumber,
    status: request.status,
    reviewNote: request.reviewNote ?? null,
  }));
}
