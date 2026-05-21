/**
 * Operator-configured payment rails for referral / customer checkout.
 * Stored on referral_links.checkout_config (referralCommerce.enabledPaymentRails).
 */

import { parseReferralCommerceFromCheckoutConfig } from '@/lib/referrals/referral-commerce-config';

export type ReferralPaymentRail = 'stripe' | 'wise' | 'hedera' | 'manual';

const VALID_RAILS = new Set<ReferralPaymentRail>(['stripe', 'wise', 'hedera', 'manual']);

export type ReferralPaymentRailOption = {
  id: ReferralPaymentRail;
  label: string;
  description: string;
};

export const REFERRAL_PAYMENT_RAIL_OPTIONS: ReferralPaymentRailOption[] = [
  { id: 'stripe', label: 'Card', description: 'Pay by credit or debit card' },
  { id: 'wise', label: 'Bank transfer', description: 'Pay via bank transfer' },
  { id: 'hedera', label: 'Crypto', description: 'Pay with supported digital assets' },
  { id: 'manual', label: 'Manual settlement', description: 'Pay using operator-provided instructions' },
];

const CONFIG_KEY = 'referralPaymentRails';
const CUSTOM_AMOUNT_KEY = 'allowCustomAmount';

export type MerchantRailAvailability = {
  stripe: boolean;
  wise: boolean;
  hedera: boolean;
  manual: boolean;
};

export function defaultReferralPaymentRails(): ReferralPaymentRail[] {
  return ['stripe'];
}

function sanitizeRailList(raw: unknown): ReferralPaymentRail[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is ReferralPaymentRail => typeof r === 'string' && VALID_RAILS.has(r as ReferralPaymentRail)
  );
}

export function parseReferralPaymentRailsFromCheckoutConfig(
  config: unknown
): ReferralPaymentRail[] | null {
  if (!config || typeof config !== 'object') return null;
  const top = sanitizeRailList((config as Record<string, unknown>)[CONFIG_KEY]);
  if (top.length > 0) return top;

  const commerce = parseReferralCommerceFromCheckoutConfig(config);
  const fromCommerce = sanitizeRailList(commerce?.enabledPaymentRails);
  return fromCommerce.length > 0 ? fromCommerce : null;
}

export function isCustomAmountAllowedOnCheckoutConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') return true;
  const raw = (config as Record<string, unknown>)[CUSTOM_AMOUNT_KEY];
  if (raw === false) return false;
  const commerce = parseReferralCommerceFromCheckoutConfig(config);
  if (commerce?.allowCustomAmount === false) return false;
  return true;
}

export function mergeReferralPaymentRailsIntoCheckoutConfig(
  base: Record<string, unknown>,
  rails: ReferralPaymentRail[],
  options?: { allowCustomAmount?: boolean }
): Record<string, unknown> {
  const unique = sanitizeRailList(rails);
  const next: Record<string, unknown> = {
    ...base,
    [CONFIG_KEY]: unique.length > 0 ? unique : defaultReferralPaymentRails(),
  };
  if (options?.allowCustomAmount === false) {
    next[CUSTOM_AMOUNT_KEY] = false;
  } else if (options?.allowCustomAmount === true) {
    next[CUSTOM_AMOUNT_KEY] = true;
  }
  return next;
}

/** Rails the operator selected for this participant / referral link. */
export function getConfiguredReferralPaymentRails(checkoutConfig: unknown): ReferralPaymentRail[] {
  return parseReferralPaymentRailsFromCheckoutConfig(checkoutConfig) ?? defaultReferralPaymentRails();
}

function isRailAvailableAtMerchant(
  rail: ReferralPaymentRail,
  merchant: MerchantRailAvailability
): boolean {
  switch (rail) {
    case 'stripe':
      return merchant.stripe;
    case 'wise':
      return merchant.wise;
    case 'hedera':
      return merchant.hedera;
    case 'manual':
      return merchant.manual;
    default:
      return false;
  }
}

/** Intersect operator selection with merchant capabilities; never throws. */
export function resolveCustomerPaymentRails(input: {
  checkoutConfig: unknown;
  merchant: MerchantRailAvailability;
}): ReferralPaymentRail[] {
  return resolveAvailablePaymentRails(input);
}

/**
 * Validate and resolve customer-visible payment rails.
 * Returns [] when none are available (caller shows unavailable UI).
 */
export function resolveAvailablePaymentRails(input: {
  checkoutConfig: unknown;
  merchant: MerchantRailAvailability;
}): ReferralPaymentRail[] {
  try {
    const configured = getConfiguredReferralPaymentRails(input.checkoutConfig);
    const resolved = configured.filter((rail) => isRailAvailableAtMerchant(rail, input.merchant));
    return [...new Set(resolved)];
  } catch (error) {
    console.warn('[ReferralPaymentRails] resolve failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export type ReferralRailResolutionLog = {
  referralCode: string;
  organizationId: string;
  configuredRails: ReferralPaymentRail[];
  resolvedRails: ReferralPaymentRail[];
  merchantCapabilities: MerchantRailAvailability;
  brandingFallback: boolean;
  serviceCount: number;
};

export function logReferralCheckoutContext(context: ReferralRailResolutionLog): void {
  console.info('[ReferralCheckout]', {
    referralCode: context.referralCode,
    organizationId: context.organizationId,
    configuredRails: context.configuredRails,
    resolvedRails: context.resolvedRails,
    merchantCapabilities: context.merchantCapabilities,
    brandingFallback: context.brandingFallback,
    serviceCount: context.serviceCount,
  });
}

export function referralRailToPaymentMethod(
  rail: ReferralPaymentRail
): 'STRIPE' | 'WISE' | 'HEDERA' | 'MANUAL_BANK' | null {
  switch (rail) {
    case 'stripe':
      return 'STRIPE';
    case 'wise':
      return 'WISE';
    case 'hedera':
      return 'HEDERA';
    case 'manual':
      return 'MANUAL_BANK';
    default:
      return null;
  }
}

export function customerRailLabel(rail: ReferralPaymentRail): string {
  return REFERRAL_PAYMENT_RAIL_OPTIONS.find((o) => o.id === rail)?.label ?? 'Payment';
}
