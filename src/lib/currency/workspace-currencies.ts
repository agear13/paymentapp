/**
 * Central currency list for workspace onboarding, collection settings, and payout display defaults.
 * Prefer this module over hardcoded dropdown arrays in UI.
 */
export const WORKSPACE_CURRENCIES = [
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'NZD', name: 'New Zealand Dollar' },
] as const;

export type WorkspaceCurrencyCode = (typeof WORKSPACE_CURRENCIES)[number]['code'];

export const DEFAULT_WORKSPACE_CURRENCY: WorkspaceCurrencyCode = 'AUD';

export function isWorkspaceCurrencyCode(code: string): code is WorkspaceCurrencyCode {
  return WORKSPACE_CURRENCIES.some((c) => c.code === code);
}
