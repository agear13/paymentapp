/**
 * Operator-controlled referral commerce settings (stored on participant payload + referral_links.checkout_config).
 */

export type ReferralCommissionMode = 'project_revenue_share' | 'referral_commerce';

import type { ReferralPaymentRail } from '@/lib/referrals/referral-payment-rails';
import { defaultReferralPaymentRails } from '@/lib/referrals/referral-payment-rails';
import {
  normalizeManualPayoutMethod,
  type ManualPayoutMethod,
} from '@/lib/participants/manual-payout-method';

export type { ManualPayoutMethod };

export type ParticipantReferralCommerce = {
  /** When false, no referral link is issued on approval. Default true when omitted (legacy). */
  createReferralLink?: boolean;
  commissionMode: ReferralCommissionMode;
  /** % of each service sale when commissionMode is referral_commerce (0–100). */
  commerceCommissionPct?: number;
  /** When set (non-empty), only these organization_services are exposed on the referral landing. */
  enabledServiceIds?: string[];
  /** Customer-facing payment methods on this participant's link. Defaults to card only. */
  enabledPaymentRails?: ReferralPaymentRail[];
  /** When false, hide custom-amount checkout on the referral landing. */
  allowCustomAmount?: boolean;
};

const MANUAL_PAYOUT_KEY = 'manualPayoutMethod';

const CONFIG_KEY = 'referralCommerce';

export function defaultReferralCommerce(): ParticipantReferralCommerce {
  return {
    createReferralLink: true,
    commissionMode: 'project_revenue_share',
    commerceCommissionPct: 10,
    enabledServiceIds: [],
    enabledPaymentRails: defaultReferralPaymentRails(),
    allowCustomAmount: true,
  };
}

export function shouldIssueReferralLink(commerce?: ParticipantReferralCommerce | null): boolean {
  if (!commerce) return true;
  return commerce.createReferralLink !== false;
}

export function parseManualPayoutMethodFromCheckoutConfig(
  config: unknown
): ManualPayoutMethod | null {
  if (!config || typeof config !== 'object') return null;
  const raw = (config as Record<string, unknown>)[MANUAL_PAYOUT_KEY];
  return normalizeManualPayoutMethod(raw as Partial<ManualPayoutMethod>);
}

export function mergeManualPayoutMethodIntoCheckoutConfig(
  base: Record<string, unknown>,
  method: ManualPayoutMethod | null | undefined
): Record<string, unknown> {
  const normalized = normalizeManualPayoutMethod(method ?? undefined);
  if (!normalized) {
    const { [MANUAL_PAYOUT_KEY]: _removed, ...rest } = base;
    return rest;
  }
  return { ...base, [MANUAL_PAYOUT_KEY]: normalized };
}

export function parseReferralCommerceFromCheckoutConfig(
  config: unknown
): ParticipantReferralCommerce | null {
  if (!config || typeof config !== 'object') return null;
  const raw = (config as Record<string, unknown>)[CONFIG_KEY];
  if (!raw || typeof raw !== 'object') return null;
  return normalizeReferralCommerce(raw as Partial<ParticipantReferralCommerce>);
}

export function normalizeReferralCommerce(
  input: Partial<ParticipantReferralCommerce>
): ParticipantReferralCommerce {
  const mode =
    input.commissionMode === 'referral_commerce' ? 'referral_commerce' : 'project_revenue_share';
  const pct = Number(input.commerceCommissionPct);
  const rails = Array.isArray(input.enabledPaymentRails)
    ? [...new Set(input.enabledPaymentRails.filter((r) => typeof r === 'string'))]
    : defaultReferralPaymentRails();

  return {
    createReferralLink: input.createReferralLink !== false,
    commissionMode: mode,
    commerceCommissionPct:
      Number.isFinite(pct) && pct >= 0 ? Math.min(100, pct) : 10,
    enabledServiceIds: Array.isArray(input.enabledServiceIds)
      ? [...new Set(input.enabledServiceIds.filter((id) => typeof id === 'string' && id.trim()))]
      : [],
    enabledPaymentRails: rails.length > 0 ? (rails as ReferralPaymentRail[]) : defaultReferralPaymentRails(),
    allowCustomAmount: input.allowCustomAmount !== false,
  };
}

export function mergeReferralCommerceIntoCheckoutConfig(
  base: Record<string, unknown>,
  commerce: ParticipantReferralCommerce
): Record<string, unknown> {
  return {
    ...base,
    [CONFIG_KEY]: normalizeReferralCommerce(commerce),
  };
}

export function buildCheckoutConfigFields(commerce: ParticipantReferralCommerce): Record<string, unknown> {
  return mergeReferralCommerceIntoCheckoutConfig({}, commerce);
}

/** Service ids explicitly scoped on this link; empty = all active services allowed. */
export function getScopedServiceIds(checkoutConfig: unknown): string[] | null {
  const commerce = parseReferralCommerceFromCheckoutConfig(checkoutConfig);
  if (!commerce || commerce.commissionMode !== 'referral_commerce') return null;
  const ids = commerce.enabledServiceIds;
  if (!ids || ids.length === 0) return null;
  return ids;
}

export function filterServicesForReferralConfig<T extends { id: string }>(
  services: T[],
  checkoutConfig: unknown
): T[] {
  const scoped = getScopedServiceIds(checkoutConfig);
  if (!scoped) return services;
  const allowed = new Set(scoped);
  return services.filter((s) => allowed.has(s.id));
}

export function isServiceAllowedForReferral(
  checkoutConfig: unknown,
  organizationServiceId: string
): boolean {
  const scoped = getScopedServiceIds(checkoutConfig);
  if (!scoped) return true;
  return scoped.includes(organizationServiceId);
}

export function commerceCommissionPctDecimal(commerce: ParticipantReferralCommerce): number {
  const pct = commerce.commerceCommissionPct ?? 10;
  return Math.min(1, Math.max(0, pct > 1 ? pct / 100 : pct));
}

export function describeReferralCommerce(
  commerce: ParticipantReferralCommerce,
  serviceNames?: string[]
): string {
  if (commerce.commissionMode === 'referral_commerce') {
    const pct = commerce.commerceCommissionPct ?? 10;
    const services =
      serviceNames && serviceNames.length > 0
        ? serviceNames.join(', ')
        : commerce.enabledServiceIds && commerce.enabledServiceIds.length > 0
          ? `${commerce.enabledServiceIds.length} selected service(s)`
          : 'all active services';
    return `You earn ${pct}% commission when customers purchase ${services} through your referral link.`;
  }
  return 'You may earn project-level commission per your agreement, plus referral link sharing when enabled.';
}
