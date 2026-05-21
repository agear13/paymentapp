import { formatCurrency, formatCompactCurrency } from '@/lib/formatters/format-currency';

/**
 * Format amounts for payout surfaces. Prefer obligation/line currency when provided;
 * fall back to organization default currency — never assume USD unless that is the actual code.
 */
export function formatPayoutCurrency(
  amount: number | null | undefined,
  currencyCode?: string | null,
  organizationDefaultCurrency?: string | null
): string {
  const code =
    currencyCode?.trim() ||
    organizationDefaultCurrency?.trim() ||
    'AUD';
  return formatCurrency(amount, code);
}

export function formatPayoutCompactCurrency(
  amount: number | null | undefined,
  currencyCode?: string | null,
  organizationDefaultCurrency?: string | null
): string {
  const code =
    currencyCode?.trim() ||
    organizationDefaultCurrency?.trim() ||
    'AUD';
  return formatCompactCurrency(amount, code);
}

/** @deprecated Use formatPayoutCurrency — alias for migration */
export const formatOrganizationCurrency = formatPayoutCurrency;
