import {
  resolveCatalogDefaultCurrency,
  PLATFORM_FALLBACK_CURRENCY,
} from '@/lib/currency/resolve-catalog-default-currency';
import { isWorkspaceCurrencyCode } from '@/lib/currency/workspace-currencies';

function normalizeCurrencyCode(code: string | null | undefined): string | null {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || normalized.length !== 3) return null;
  return normalized;
}

/**
 * Canonical operational currency for compensation, agreements, and payout display.
 * Hierarchy: project currency → workspace activation → merchant/org → platform fallback.
 */
export function resolveOperationalWorkspaceCurrency(input: {
  projectCurrency?: string | null;
  workspaceDefaultCurrency?: string | null;
  merchantDefaultCurrency?: string | null;
}): string {
  const project = normalizeCurrencyCode(input.projectCurrency);
  if (project && isWorkspaceCurrencyCode(project)) return project;
  if (project) return project;

  return resolveCatalogDefaultCurrency({
    workspaceDefaultCurrency: input.workspaceDefaultCurrency,
    merchantDefaultCurrency: input.merchantDefaultCurrency,
  });
}

export { PLATFORM_FALLBACK_CURRENCY };
