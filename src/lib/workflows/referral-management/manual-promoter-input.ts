import type { ReferralCompensationInput, ReferralPromoterRole } from '@/lib/workflows/referral-management/constants';
import {
  earningSourceTypeOf,
  findKnownExternalPlatform,
  validateExternalEarningSource,
  type ReferralAttributionMethod,
  type ReferralEarningSourceType,
} from '@/lib/workflows/referral-management/earning-source';

export type ManualPromoterDraft = {
  name: string;
  email?: string;
  phone?: string;
  role: ReferralPromoterRole;
  roleLabel?: string;
  compensationKind: 'revenue_share' | 'fixed';
  percentage?: number;
  amount?: number;
  currency?: string;
  serviceIds: string[];
  earningSourceType: ReferralEarningSourceType;
  externalProvider?: string;
  externalService?: string;
  attributionMethod?: ReferralAttributionMethod | null;
  audienceDiscountPct?: number | null;
};

export function suggestedExternalServiceForPlatform(platform: string): string {
  return findKnownExternalPlatform(platform)?.suggestedServiceLabel ?? '';
}

function compensationValueError(draft: ManualPromoterDraft): string | null {
  if (draft.compensationKind === 'revenue_share') {
    const percentage = Number(draft.percentage);
    if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return 'Enter a revenue-share percentage between 0 and 100.';
    }
    return null;
  }
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Enter a fixed commission amount.';
  }
  return null;
}

export function buildManualAddPromoterInput(draft: ManualPromoterDraft):
  | {
      name: string;
      email?: string;
      phone?: string;
      role: ReferralPromoterRole;
      roleLabel?: string;
      compensation: ReferralCompensationInput;
    }
  | { error: string } {
  const name = draft.name.trim();
  if (!name) return { error: 'Promoter name is required.' };

  const valueError = compensationValueError(draft);
  if (valueError) return { error: valueError };

  const type = earningSourceTypeOf({ type: draft.earningSourceType });
  const roleLabel = draft.roleLabel?.trim() || undefined;
  const identity = {
    name,
    email: draft.email?.trim() || undefined,
    phone: draft.phone?.trim() || undefined,
    role: draft.role,
    roleLabel,
  };

  if (type === 'external') {
    const earningSource = {
      type: 'external' as const,
      externalProvider: draft.externalProvider?.trim() || null,
      externalService: draft.externalService?.trim() || null,
      attributionMethod: draft.attributionMethod ?? null,
      audienceDiscountPct:
        typeof draft.audienceDiscountPct === 'number' &&
        Number.isFinite(draft.audienceDiscountPct) &&
        draft.audienceDiscountPct > 0
          ? draft.audienceDiscountPct
          : null,
    };
    const externalError = validateExternalEarningSource(earningSource);
    if (externalError) return { error: externalError };

    return {
      ...identity,
      compensation:
        draft.compensationKind === 'revenue_share'
          ? {
              kind: 'revenue_share',
              percentage: Number(draft.percentage),
              earningSource,
            }
          : {
              kind: 'fixed',
              amount: Number(draft.amount),
              currency: draft.currency || 'AUD',
              earningSource,
            },
    };
  }

  const serviceIds = [...new Set(draft.serviceIds.map((id) => id.trim()).filter(Boolean))];
  if (serviceIds.length === 0) {
    return { error: 'Select at least one eligible service.' };
  }

  return {
    ...identity,
    compensation:
      draft.compensationKind === 'revenue_share'
        ? {
            kind: 'revenue_share',
            percentage: Number(draft.percentage),
            serviceIds,
            earningSource: { type: 'internal_service' },
          }
        : {
            kind: 'fixed',
            amount: Number(draft.amount),
            currency: draft.currency || 'AUD',
            serviceIds,
            earningSource: { type: 'internal_service' },
          },
  };
}
