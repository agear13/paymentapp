/**
 * Reconcile persisted Xero mapping codes with a successfully loaded chart.
 * Does not fetch Xero; callers must pass chartLoaded=false when the chart
 * request failed so mappings are left unchanged.
 */

import type { XeroMappingField } from '@/lib/accounting/recommended-accounting-config';
import { withSaveableCryptoSettlementStrategy } from '@/lib/accounting/crypto-settlement-strategy';

export const XERO_MAPPING_CODE_FIELDS: readonly XeroMappingField[] = [
  'xero_revenue_account_id',
  'xero_receivable_account_id',
  'xero_stripe_clearing_account_id',
  'xero_hbar_clearing_account_id',
  'xero_usdc_clearing_account_id',
  'xero_usdt_clearing_account_id',
  'xero_audd_clearing_account_id',
  'xero_wise_clearing_account_id',
  'xero_fee_expense_account_id',
] as const;

export type XeroMappingSnapshot = Partial<Record<XeroMappingField, string | null | undefined>> & {
  crypto_settlement_strategy?: 'shared' | 'per_asset' | null;
};

export type ClearedXeroMapping = {
  field: XeroMappingField;
  previousCode: string;
  reason: 'missing_from_loaded_chart';
};

export type ReconcileXeroMappingsResult = {
  mappings: XeroMappingSnapshot;
  clearedMappings: ClearedXeroMapping[];
  /** True when mappings were left unchanged because no successful chart was provided. */
  skippedBecauseChartUnavailable: boolean;
};

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

export function chartCodesFromAccounts(
  accounts: Array<{ code?: string | null; status?: string | null }>
): Set<string> {
  return new Set(
    accounts
      .filter((account) => {
        const status = (account.status ?? '').trim().toLowerCase();
        return !status || status === 'active';
      })
      .map((account) => trimmed(account.code))
      .filter((code): code is string => Boolean(code))
  );
}

export function missingMappedAccountCodes(
  mappedCodes: string[],
  chartAccountCodes: Set<string>
): string[] {
  const unique = [...new Set(mappedCodes.map((code) => code.trim()).filter(Boolean))];
  return unique.filter((code) => !chartAccountCodes.has(code));
}

/**
 * Keep codes that exist in the loaded chart (including new replacements).
 * Null out codes that the loaded chart proves are absent.
 * If the chart was not loaded successfully, return mappings unchanged.
 */
export function reconcileXeroMappingsWithLoadedChart(
  mappings: XeroMappingSnapshot,
  chart: { loaded: boolean; codes: Set<string> | null }
): ReconcileXeroMappingsResult {
  if (!chart.loaded || !chart.codes) {
    return {
      mappings: { ...mappings },
      clearedMappings: [],
      skippedBecauseChartUnavailable: true,
    };
  }

  const next: XeroMappingSnapshot = { ...mappings };
  const clearedMappings: ClearedXeroMapping[] = [];

  for (const field of XERO_MAPPING_CODE_FIELDS) {
    if (!(field in mappings)) {
      continue;
    }
    const value = trimmed(mappings[field]);
    if (!value) {
      next[field] = mappings[field] ? null : mappings[field];
      continue;
    }
    if (chart.codes.has(value)) {
      next[field] = value;
      continue;
    }
    next[field] = null;
    clearedMappings.push({
      field,
      previousCode: value,
      reason: 'missing_from_loaded_chart',
    });
  }

  return {
    mappings: next,
    clearedMappings,
    skippedBecauseChartUnavailable: false,
  };
}

export function persistableXeroMappingCode(value: string | null | undefined): string | null {
  return trimmed(value);
}

/** Empty holding / invoice codes become null so unresolved rails do not fail persistence. */
export function nullEmptyXeroMappingCodes(mappings: XeroMappingSnapshot): XeroMappingSnapshot {
  const next: XeroMappingSnapshot = { ...mappings };
  for (const field of XERO_MAPPING_CODE_FIELDS) {
    if (!(field in next)) {
      continue;
    }
    next[field] = persistableXeroMappingCode(next[field]);
  }
  return next;
}

/**
 * Chart-reconcile, null empty codes, and align crypto strategy so valid
 * Stripe/USDC/HBAR mappings persist even when Wise/USDT/AUDD stay unresolved.
 */
export function prepareXeroMappingsForPersistence(
  mappings: XeroMappingSnapshot,
  chart: { loaded: boolean; codes: Set<string> | null }
): ReconcileXeroMappingsResult {
  const emptied = nullEmptyXeroMappingCodes(mappings);
  const reconciled = reconcileXeroMappingsWithLoadedChart(emptied, chart);
  return {
    ...reconciled,
    mappings: withSaveableCryptoSettlementStrategy(reconciled.mappings),
  };
}
