/**
 * Single source of truth for Payment Link App payment-rail setup.
 * Use for onboarding, create-invoice guardrails, and any readiness checks.
 *
 * Scope: Payment Links product only — not Deal Network / Rabbit Hole shells.
 *
 * This module is **client-safe** (no Prisma). Server routes should load `merchant_settings`
 * then pass the row into {@link computePaymentLinkRailSetup}.
 */

/** Merchant fields required to evaluate rail setup (matches typical Prisma select). */
export type PaymentLinkMerchantRailSnapshot = {
  stripe_account_id: string | null;
  hedera_account_id: string | null;
  wise_enabled: boolean;
  wise_profile_id: string | null;
};

/**
 * Normalized rail setup for an organization — derived only from merchant_settings conventions.
 */
export type PaymentLinkRailSetupStatus = {
  stripeConfigured: boolean;
  wiseConfigured: boolean;
  /** Wise toggled on in UI but profile id missing — needs attention before relying on Wise. */
  wiseIncomplete: boolean;
  hederaConfigured: boolean;
  /** True if Stripe, or fully configured Wise, or Hedera account is present. */
  anyRailConfigured: boolean;
  /** True when at least one valid receiving rail exists (same as anyRailConfigured for Payment Links). */
  readyForPaymentRequests: boolean;
};

function nonEmpty(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.trim().length > 0;
}

/**
 * Pure: compute rail flags from a merchant row snapshot (or null if no row).
 * Shared by onboarding, future invoice guardrails, and any UI that already has settings loaded.
 */
export function computePaymentLinkRailSetup(
  merchant: PaymentLinkMerchantRailSnapshot | null
): PaymentLinkRailSetupStatus {
  if (!merchant) {
    return {
      stripeConfigured: false,
      wiseConfigured: false,
      wiseIncomplete: false,
      hederaConfigured: false,
      anyRailConfigured: false,
      readyForPaymentRequests: false,
    };
  }

  const stripeConfigured = nonEmpty(merchant.stripe_account_id);
  const wiseConfigured = merchant.wise_enabled === true && nonEmpty(merchant.wise_profile_id);
  const wiseIncomplete = merchant.wise_enabled === true && !nonEmpty(merchant.wise_profile_id);
  const hederaConfigured = nonEmpty(merchant.hedera_account_id);

  const anyRailConfigured = stripeConfigured || wiseConfigured || hederaConfigured;
  const readyForPaymentRequests = anyRailConfigured;

  return {
    stripeConfigured,
    wiseConfigured,
    wiseIncomplete,
    hederaConfigured,
    anyRailConfigured,
    readyForPaymentRequests,
  };
}

/**
 * Maps camelCase merchant settings (API / Create Invoice dialog) to {@link PaymentLinkMerchantRailSnapshot}.
 */
export function toPaymentLinkRailSnapshot(
  merchant:
    | {
        stripeAccountId?: string | null;
        hederaAccountId?: string | null;
        wiseEnabled?: boolean;
        wiseProfileId?: string | null;
      }
    | null
    | undefined
): PaymentLinkMerchantRailSnapshot | null {
  if (!merchant) return null;
  return {
    stripe_account_id: merchant.stripeAccountId ?? null,
    hedera_account_id: merchant.hederaAccountId ?? null,
    wise_enabled: merchant.wiseEnabled === true,
    wise_profile_id: merchant.wiseProfileId ?? null,
  };
}

/**
 * Picks a different payment method that is fully configured, or null if none.
 */
export function pickAlternativePaymentMethod(
  setup: PaymentLinkRailSetupStatus,
  current: 'STRIPE' | 'HEDERA' | 'WISE'
): 'STRIPE' | 'HEDERA' | 'WISE' | null {
  const order: ('STRIPE' | 'HEDERA' | 'WISE')[] = ['STRIPE', 'HEDERA', 'WISE'];
  for (const m of order) {
    if (m === current) continue;
    if (m === 'STRIPE' && setup.stripeConfigured) return m;
    if (m === 'HEDERA' && setup.hederaConfigured) return m;
    if (m === 'WISE' && setup.wiseConfigured) return m;
  }
  return null;
}
