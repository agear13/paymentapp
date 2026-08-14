/**
 * Merchant/customer copy and gating for Wise vs manual bank transfer — UX only.
 * Automated Wise checkout requires platform auto-settlement; otherwise use MANUAL_BANK.
 */

import type { PaymentRailPlatformFeatures } from '@/lib/payments/payment-rail-merchant-readiness';

/** Shown when Wise profile exists but automated checkout is not operational. */
export const WISE_AUTO_SETTLEMENT_UNAVAILABLE_REASON =
  'Automated Wise checkout is not available yet. Use Bank transfer (manual verification) — you confirm payment after the customer sends funds.';

export const WISE_INVOICE_UNAVAILABLE_WHEN_AUTO_OFF =
  'Automated Wise checkout is not enabled on this environment. Choose Bank transfer (manual verification) instead.';

export const WISE_MERCHANT_PROFILE_SAVED_COPY =
  'Your Wise profile is saved for bank details and future automated checkout. For invoices today, choose Bank transfer (manual verification).';

export const WISE_MERCHANT_WILL_NOT_APPEAR_COPY =
  'Wise will not appear as an automated checkout option until auto-settlement is enabled by your platform administrator.';

export const MANUAL_BANK_RECOMMENDED_HELPER =
  'Customers pay using your bank instructions, then you verify and mark the payment in Provvy. Funds are recorded in Xero against Wise Holding.';

/** True when Wise can be offered on checkout (matches public-checkout-methods.server.ts). */
export function isWiseCheckoutOperational(
  features: PaymentRailPlatformFeatures
): boolean {
  return Boolean(features.wisePayments && features.wiseAutoSettlementAvailable);
}

/** True when merchants can select WISE on invoice creation. */
export function isWiseInvoiceMethodAvailable(
  features: PaymentRailPlatformFeatures
): boolean {
  return isWiseCheckoutOperational(features);
}
