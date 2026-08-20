import {
  reconcileXeroMappingsWithLoadedChart,
  missingMappedAccountCodes,
  prepareXeroMappingsForPersistence,
} from '@/lib/accounting/reconcile-xero-mappings';
import { buildPaymentAccountMappingView, paymentAccountLinkLabel } from '@/lib/accounting/payment-account-mapping-view';
import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';
import { formatMappingIssue } from '@/lib/xero/xero-customer-messages';
import { resolvePaymentAccountRecommendation } from '@/lib/accounting/payment-account-recommendations';
import { STRIPE_HOLDING } from '@/lib/accounting/settlement-account-config';

const usdcDefinition = {
  id: 'per-asset-usdc',
  kind: 'per_asset' as const,
  title: 'USDC Holding',
  accountName: 'USDC Holding',
  mappingField: 'xero_usdc_clearing_account_id' as const,
  suggestedCode: '1052',
  paymentAsset: 'USDC',
  paymentRail: 'crypto',
};

const chart = [
  { code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
  { code: '610', name: 'Accounts Receivable', type: 'CURRENT', status: 'ACTIVE' },
  { code: '1050', name: 'Stripe Holding', type: 'CURRENT', status: 'ACTIVE' },
  { code: '1052', name: 'USDC Holding', type: 'CURRENT', status: 'ACTIVE' },
];

const chartCodes = new Set(['200', '610', '1050', '1052']);

describe('reconcileXeroMappingsWithLoadedChart', () => {
  it('saves a USDC replacement and clears another stale mapping without touching valid ones', () => {
    const result = reconcileXeroMappingsWithLoadedChart(
      {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '1050',
        xero_hbar_clearing_account_id: '9999',
        xero_usdc_clearing_account_id: '1052',
        crypto_settlement_strategy: 'per_asset',
      },
      { loaded: true, codes: chartCodes }
    );

    expect(result.skippedBecauseChartUnavailable).toBe(false);
    expect(result.mappings.xero_usdc_clearing_account_id).toBe('1052');
    expect(result.mappings.xero_hbar_clearing_account_id).toBeNull();
    expect(result.mappings.xero_stripe_clearing_account_id).toBe('1050');
    expect(result.mappings.xero_revenue_account_id).toBe('200');
    expect(result.clearedMappings).toEqual([
      {
        field: 'xero_hbar_clearing_account_id',
        previousCode: '9999',
        reason: 'missing_from_loaded_chart',
      },
    ]);
    expect(missingMappedAccountCodes(['1052', '1050', '200', '610'], chartCodes)).toEqual([]);
  });

  it('does not clear mappings when the Xero chart was not loaded', () => {
    const mappings = {
      xero_revenue_account_id: '200',
      xero_usdc_clearing_account_id: '9999',
    };
    const result = reconcileXeroMappingsWithLoadedChart(mappings, {
      loaded: false,
      codes: null,
    });

    expect(result.skippedBecauseChartUnavailable).toBe(true);
    expect(result.clearedMappings).toEqual([]);
    expect(result.mappings.xero_usdc_clearing_account_id).toBe('9999');
    expect(result.mappings.xero_revenue_account_id).toBe('200');
  });
});

describe('prepareXeroMappingsForPersistence', () => {
  it('persists Stripe/USDC/HBAR and leaves unresolved Wise/USDT/AUDD as null', () => {
    const result = prepareXeroMappingsForPersistence(
      {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '1050',
        xero_usdc_clearing_account_id: '1052',
        xero_hbar_clearing_account_id: '1051',
        xero_usdt_clearing_account_id: '',
        xero_audd_clearing_account_id: null,
        xero_wise_clearing_account_id: '9999',
        crypto_settlement_strategy: 'shared',
      },
      { loaded: true, codes: new Set(['200', '610', '1050', '1051', '1052']) }
    );

    expect(result.mappings.xero_stripe_clearing_account_id).toBe('1050');
    expect(result.mappings.xero_usdc_clearing_account_id).toBe('1052');
    expect(result.mappings.xero_hbar_clearing_account_id).toBe('1051');
    expect(result.mappings.xero_usdt_clearing_account_id).toBeNull();
    expect(result.mappings.xero_audd_clearing_account_id).toBeNull();
    expect(result.mappings.xero_wise_clearing_account_id).toBeNull();
    expect(result.mappings.crypto_settlement_strategy).toBe('per_asset');
    expect(result.clearedMappings.map((item) => item.field)).toEqual([
      'xero_wise_clearing_account_id',
    ]);
  });
});

describe('stale USDC replacement copy and link presentation', () => {
  it('does not mention an unrelated suggested create code when a replacement exists', () => {
    const result = resolvePaymentAccountRecommendation(chart, usdcDefinition, '8888');

    expect(result.status).toBe('update_mapping');
    expect(result.recommendedAccount?.code).toBe('1052');
    expect(result.actionableGuidance).toContain('USDC Holding');
    expect(result.actionableGuidance).toContain('1052');
    expect(result.actionableGuidance).not.toContain('1051');
    expect(result.actionableGuidance).not.toMatch(/link .*\(1052\).*code 1051/);
  });

  it('shows Linked after the replacement is persisted', () => {
    const persisted = buildPaymentAccountMappingView(chart, usdcDefinition, '1052');
    expect(persisted.state).toBe('linked');
    expect(persisted.complete).toBe(true);
    expect(
      paymentAccountLinkLabel({
        persistedState: persisted.state,
        persistedCode: persisted.persistedCode,
        draftCode: '1052',
      })
    ).toBe('linked');
  });

  it('shows Selected before save when a replacement is chosen against a stale mapping', () => {
    const persisted = buildPaymentAccountMappingView(chart, usdcDefinition, '8888');
    expect(persisted.state).toBe('stale_mapping');
    expect(
      paymentAccountLinkLabel({
        persistedState: persisted.state,
        persistedCode: persisted.persistedCode,
        draftCode: '1052',
      })
    ).toBe('selected');
  });
});

describe('formatMappingIssue for mapping save failures', () => {
  it('exposes the actual missing account codes instead of a generic save failure', () => {
    const issue = formatMappingIssue(
      'Some mapped Xero account codes are no longer available: 9999. Refresh accounts and reselect valid options.'
    );

    expect(issue.message).toContain('9999');
    expect(issue.message).not.toBe('Provvy could not save your Xero account choices.');
  });
});

describe('sync readiness after repaired USDC mapping', () => {
  it('treats the repaired USDC mapping as configured and remaining empty holdings as unresolved', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '1050',
        xero_usdc_clearing_account_id: '1052',
        xero_hbar_clearing_account_id: null,
        crypto_settlement_strategy: 'per_asset',
      },
      chartAccountCodes: chartCodes,
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: {
        stripeEnabled: true,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: false,
      },
      merchantPaymentCapabilities: {
        hederaConfigured: false,
        evmConfigured: true,
        enabledSettlementTokens: ['USDC'],
      },
    });

    expect(result.fieldStates.xero_usdc_clearing_account_id).toBe('configured');
    expect(result.fieldStates.xero_stripe_clearing_account_id).toBe('configured');
    expect(result.settlementAccountsNeedAction).toBe(false);
    expect(result.canSyncToAccounting).toBe(true);
  });

  it('is not payment-complete when a required holding was cleared and not replaced', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '1050',
        xero_usdc_clearing_account_id: null,
        crypto_settlement_strategy: 'per_asset',
      },
      chartAccountCodes: chartCodes,
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: {
        stripeEnabled: true,
        wiseEnabled: false,
        stablecoinSettlementsEnabled: true,
        manualBankEnabled: false,
      },
      merchantPaymentCapabilities: {
        hederaConfigured: false,
        evmConfigured: true,
        enabledSettlementTokens: ['USDC'],
      },
    });

    expect(result.fieldStates.xero_usdc_clearing_account_id).toBe('required');
    expect(result.settlementAccountsNeedAction).toBe(true);
    expect(result.canSyncToAccounting).toBe(true);
    expect(result.paymentAccountingStatus).toBe('partial');
  });
});

describe('Stripe holding recommendation still scores independently', () => {
  it('keeps Stripe Holding on 1050', () => {
    expect(STRIPE_HOLDING.suggestedCode).toBe('1050');
  });
});
