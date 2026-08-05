/**
 * UI-only display helpers for payment account recommendations.
 * Does not alter recommendation or settlement logic.
 */

import type { PaymentAccountRecommendation } from '@/lib/accounting/payment-account-recommendations';

const GENERIC_FALLBACK_NAME_PATTERNS = [
  'suspense account',
  'suspense',
  'clearing account',
] as const;

export function isGenericFallbackAccountName(name: string | null | undefined): boolean {
  const normalized = (name ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return GENERIC_FALLBACK_NAME_PATTERNS.some(
    (pattern) => normalized === pattern || normalized.includes(pattern)
  );
}

/** Account to show as the primary hero recommendation (hides generic suspense/clearing fallbacks). */
export function heroRecommendationAccount(recommendation: PaymentAccountRecommendation) {
  const account = recommendation.recommendedAccount;
  if (!account || recommendation.status === 'update_mapping') {
    return null;
  }
  if (isGenericFallbackAccountName(account.name)) {
    return null;
  }
  return account;
}

export function friendlyMatchSubtitle(recommendation: PaymentAccountRecommendation): string {
  if (recommendation.status === 'found') {
    return 'This account already matches what most businesses use.';
  }
  if (recommendation.matchReason?.includes('Similar name')) {
    return 'This account works the same way most businesses set up payments.';
  }
  return 'Provvy matched this account to your chart of accounts.';
}
