/**
 * Payment Links “activation” for progressive navigation / onboarding UX.
 * Client-safe — only data passed in from API or other modules.
 *
 * Heuristic (aligned with product goals):
 * - Activated when at least one valid payment rail is configured (Stripe, Wise, or Hedera),
 *   OR at least one payment link / invoice exists for the org.
 * - Otherwise the merchant is treated as “new” for sidebar simplification.
 *
 * Rail flags come from {@link computePaymentLinkRailSetup} (same as guardrails / onboarding).
 */

import type { PaymentLinkRailSetupStatus } from '@/lib/payment-links/setup-status';

export function isPaymentLinksNavActivated(
  railSetup: PaymentLinkRailSetupStatus,
  paymentLinkCount: number
): boolean {
  return railSetup.anyRailConfigured || paymentLinkCount > 0;
}
