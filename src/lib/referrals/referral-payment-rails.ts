/**
 * Operator-configured payment rails for referral / customer checkout.
 * Stored on referral_links.checkout_config alongside referralCommerce.
 */

export type ReferralPaymentRail = 'stripe' | 'wise' | 'hedera' | 'manual';

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

export function parseReferralPaymentRailsFromCheckoutConfig(
  config: unknown
): ReferralPaymentRail[] | null {
  if (!config || typeof config !== 'object') return null;
  const raw = (config as Record<string, unknown>)[CONFIG_KEY];
  if (!Array.isArray(raw)) return null;
  const allowed = new Set<ReferralPaymentRail>(['stripe', 'wise', 'hedera', 'manual']);
  const rails = raw.filter((r): r is ReferralPaymentRail => typeof r === 'string' && allowed.has(r as ReferralPaymentRail));
  return rails.length > 0 ? rails : null;
}

export function isCustomAmountAllowedOnCheckoutConfig(config: unknown): boolean {
  if (!config || typeof config !== 'object') return true;
  const raw = (config as Record<string, unknown>)[CUSTOM_AMOUNT_KEY];
  if (raw === false) return false;
  return true;
}

export function mergeReferralPaymentRailsIntoCheckoutConfig(
  base: Record<string, unknown>,
  rails: ReferralPaymentRail[],
  options?: { allowCustomAmount?: boolean }
): Record<string, unknown> {
  const unique = [...new Set(rails.filter((r) => REFERRAL_PAYMENT_RAIL_OPTIONS.some((o) => o.id === r)))];
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

/** Intersect operator selection with merchant account configuration. */
export function resolveCustomerPaymentRails(input: {
  checkoutConfig: unknown;
  merchant: MerchantRailAvailability;
}): ReferralPaymentRail[] {
  const configured = getConfiguredReferralPaymentRails(input.checkoutConfig);
  return configured.filter((rail) => {
    if (rail === 'stripe') return input.merchant.stripe;
    if (rail === 'wise') return input.merchant.wise;
    if (rail === 'hedera') return input.merchant.hedera;
    if (rail === 'manual') return input.merchant.manual;
    return false;
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
  return REFERRAL_PAYMENT_RAIL_OPTIONS.find((o) => o.id === rail)?.label ?? rail;
}
