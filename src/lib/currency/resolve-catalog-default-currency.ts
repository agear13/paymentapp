import { DEFAULT_WORKSPACE_CURRENCY, isWorkspaceCurrencyCode } from '@/lib/currency/workspace-currencies';

/** Platform fallback when no workspace/org currency is configured. */
export const PLATFORM_FALLBACK_CURRENCY = DEFAULT_WORKSPACE_CURRENCY;

function normalizeCurrencyCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || normalized.length !== 3) return null;
  return normalized;
}

/**
 * Deterministic catalog currency default hierarchy:
 * workspace default → merchant/org default → platform fallback.
 */
export function resolveCatalogDefaultCurrency(input: {
  workspaceDefaultCurrency?: string | null;
  merchantDefaultCurrency?: string | null;
}): string {
  const workspace = normalizeCurrencyCode(input.workspaceDefaultCurrency);
  if (workspace && isWorkspaceCurrencyCode(workspace)) return workspace;

  const merchant = normalizeCurrencyCode(input.merchantDefaultCurrency);
  if (merchant && isWorkspaceCurrencyCode(merchant)) return merchant;
  if (merchant) return merchant;

  return PLATFORM_FALLBACK_CURRENCY;
}
