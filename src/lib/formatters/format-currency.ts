/**
 * Canonical currency formatting for operational settlement UI.
 * Safe for null/undefined amounts and unknown currency codes.
 */

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

/** Known symbols for non-ISO and display overrides. */
const SYMBOL_BY_CODE: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  SGD: 'S$',
  NZD: 'NZ$',
  HKD: 'HK$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  IDR: 'Rp',
  HBAR: 'ℏ',
  USDC: 'USDC',
  USDT: 'USDT',
};

export type FormatCurrencyOptions = {
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

function normalizeAmount(amount: number | null | undefined): number | null {
  if (amount == null || Number.isNaN(amount) || !Number.isFinite(amount)) {
    return null;
  }
  return amount;
}

function normalizeCurrencyCode(currencyCode?: string | null): string {
  const code = currencyCode?.trim().toUpperCase();
  return code && code.length >= 3 ? code.slice(0, 3) : DEFAULT_CURRENCY;
}

function formatWithSymbol(
  amount: number,
  currencyCode: string,
  options?: FormatCurrencyOptions
): string {
  const symbol = SYMBOL_BY_CODE[currencyCode] ?? currencyCode;
  const formattedAmount = amount.toLocaleString(options?.locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
  return `${symbol}${formattedAmount}`;
}

/**
 * Format a monetary amount with currency code or symbol.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode?: string | null,
  options?: FormatCurrencyOptions
): string {
  const value = normalizeAmount(amount);
  if (value == null) return '—';

  const code = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat(options?.locale ?? DEFAULT_LOCALE, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(value);
  } catch {
    return formatWithSymbol(value, code, options);
  }
}

/**
 * Compact currency for dashboards (e.g. $1.2K).
 */
export function formatCompactCurrency(
  amount: number | null | undefined,
  currencyCode?: string | null,
  options?: FormatCurrencyOptions
): string {
  const value = normalizeAmount(amount);
  if (value == null) return '—';

  const code = normalizeCurrencyCode(currencyCode);

  try {
    return new Intl.NumberFormat(options?.locale ?? DEFAULT_LOCALE, {
      style: 'currency',
      currency: code,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return formatWithSymbol(value, code, {
      ...options,
      maximumFractionDigits: 1,
    });
  }
}

/**
 * Numeric amount only — no currency symbol.
 */
export function formatCurrencyWithoutSymbol(
  amount: number | null | undefined,
  options?: Pick<FormatCurrencyOptions, 'locale' | 'minimumFractionDigits' | 'maximumFractionDigits'>
): string {
  const value = normalizeAmount(amount);
  if (value == null) return '—';

  return value.toLocaleString(options?.locale ?? DEFAULT_LOCALE, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
}
