/**
 * Isolated early-payment incentive policy.
 * Not a global commercial rule engine — replace with configuration later.
 */
export const EARLY_PAYMENT_INCENTIVE_POLICY = {
  id: 'early_payment_discount_v1',
  /** Minimum extracted delay (days after delivery/invoice) before suggesting acceleration. */
  minDelayedDays: 30,
  acceleratedDays: 7,
  incentivePercent: 2,
} as const;

export const EARLY_PAYMENT_INCENTIVE_DISCLAIMER =
  'Example incentive only. Illustrative amounts assume the buyer pays within the accelerated window. Provvy will not change the agreement without your approval. This is not supplier acceptance.';
