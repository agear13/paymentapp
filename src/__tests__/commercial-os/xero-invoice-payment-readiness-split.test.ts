import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';
import { prepareXeroMappingsForPersistence } from '@/lib/accounting/reconcile-xero-mappings';
import {
  buildPaymentAccountMappingView,
  paymentAccountLinkLabel,
} from '@/lib/accounting/payment-account-mapping-view';
import { formatClearingAccountCreateFailures, formatMappingIssue } from '@/lib/xero/xero-customer-messages';
import { validateXeroMappingDuplicates } from '@/lib/accounting/validate-xero-mapping-duplicates';

const PARTIAL_HOLDING_CHART = [
  { code: '200', name: 'Sales', type: 'REVENUE', status: 'ACTIVE' },
  { code: '610', name: 'Accounts Receivable', type: 'CURRENT', status: 'ACTIVE' },
  { code: '1050', name: 'Stripe Holding', type: 'CURRENT', status: 'ACTIVE' },
  { code: '1051', name: 'HBAR Holding', type: 'CURRENT', status: 'ACTIVE' },
  { code: '1052', name: 'USDC Holding', type: 'CURRENT', status: 'ACTIVE' },
];

const PARTIAL_HOLDING_CODES = new Set(PARTIAL_HOLDING_CHART.map((account) => account.code));

const stripeUsdcHbarMappings = {
  xero_revenue_account_id: '200',
  xero_receivable_account_id: '610',
  xero_stripe_clearing_account_id: '1050',
  xero_usdc_clearing_account_id: '1052',
  xero_hbar_clearing_account_id: '1051',
  xero_usdt_clearing_account_id: null,
  xero_audd_clearing_account_id: null,
  xero_wise_clearing_account_id: null,
  crypto_settlement_strategy: 'per_asset' as const,
};

const enabledRails = {
  stripeEnabled: true,
  wiseEnabled: true,
  stablecoinSettlementsEnabled: true,
  manualBankEnabled: true,
};

const allTokenCapabilities = {
  hederaConfigured: true,
  evmConfigured: true,
  enabledSettlementTokens: ['USDC', 'HBAR', 'USDT', 'AUDD'],
};

function stripeUsdcHbarReadiness(overrides?: Partial<Parameters<typeof computeXeroReadiness>[0]>) {
  return computeXeroReadiness({
    status: { connected: true, tenantId: 'tenant-1' },
    mappings: stripeUsdcHbarMappings,
    chartAccountCodes: PARTIAL_HOLDING_CODES,
    chartLoaded: true,
    queue: { pendingCount: 0, hasRecentFailures: false },
    merchantRails: enabledRails,
    merchantPaymentCapabilities: allTokenCapabilities,
    ...overrides,
  });
}

describe('A. invoice readiness does not require every payment holding', () => {
  it('treats Xero as invoice-ready when only Stripe/USDC/HBAR holdings are mapped', () => {
    const result = stripeUsdcHbarReadiness();

    expect(result.connection.connected).toBe(true);
    expect(result.canSyncToAccounting).toBe(true);
    expect(result.canCreateInvoice).toBe(true);
    expect(result.heroAnswer).toBe('Yes');
    expect(result.paymentAccountingStatus).toBe('partial');
    expect(result.paymentAccountingLabel).toBe('Partially configured');
    expect(result.settlementAccountsNeedAction).toBe(true);
    expect(result.fieldStates.xero_stripe_clearing_account_id).toBe('configured');
    expect(result.fieldStates.xero_usdc_clearing_account_id).toBe('configured');
    expect(result.fieldStates.xero_hbar_clearing_account_id).toBe('configured');
    expect(result.fieldStates.xero_wise_clearing_account_id).toBe('required');
    expect(result.fieldStates.xero_usdt_clearing_account_id).toBe('required');
    expect(result.fieldStates.xero_audd_clearing_account_id).toBe('required');
  });
});

describe('B. Save Stripe/USDC/HBAR while Wise/USDT/AUDD are unresolved', () => {
  it('persists the valid mappings and leaves unresolved rails null', () => {
    const saved = prepareXeroMappingsForPersistence(
      {
        ...stripeUsdcHbarMappings,
        xero_usdt_clearing_account_id: '',
        xero_audd_clearing_account_id: '   ',
        xero_wise_clearing_account_id: '8888',
      },
      { loaded: true, codes: PARTIAL_HOLDING_CODES }
    );

    expect(saved.mappings.xero_stripe_clearing_account_id).toBe('1050');
    expect(saved.mappings.xero_usdc_clearing_account_id).toBe('1052');
    expect(saved.mappings.xero_hbar_clearing_account_id).toBe('1051');
    expect(saved.mappings.xero_usdt_clearing_account_id).toBeNull();
    expect(saved.mappings.xero_audd_clearing_account_id).toBeNull();
    expect(saved.mappings.xero_wise_clearing_account_id).toBeNull();
    expect(validateXeroMappingDuplicates(saved.mappings).valid).toBe(true);

    const afterReload = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: saved.mappings,
      chartAccountCodes: PARTIAL_HOLDING_CODES,
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: enabledRails,
      merchantPaymentCapabilities: allTokenCapabilities,
    });

    expect(afterReload.canSyncToAccounting).toBe(true);
    expect(afterReload.fieldStates.xero_stripe_clearing_account_id).toBe('configured');
    expect(afterReload.fieldStates.xero_usdc_clearing_account_id).toBe('configured');
    expect(afterReload.fieldStates.xero_hbar_clearing_account_id).toBe('configured');
    expect(afterReload.fieldStates.xero_wise_clearing_account_id).toBe('required');
  });

  it('keeps Linked on Stripe/USDC/HBAR after a partial save', () => {
    const stripe = buildPaymentAccountMappingView(
      PARTIAL_HOLDING_CHART,
      {
        id: 'stripe',
        kind: 'rail',
        title: 'Stripe Holding',
        accountName: 'Stripe Holding',
        mappingField: 'xero_stripe_clearing_account_id',
        suggestedCode: '1050',
        paymentRail: 'stripe',
      },
      '1050'
    );
    const wise = buildPaymentAccountMappingView(
      PARTIAL_HOLDING_CHART,
      {
        id: 'wise',
        kind: 'rail',
        title: 'Wise Holding',
        accountName: 'Wise Holding',
        mappingField: 'xero_wise_clearing_account_id',
        suggestedCode: '1055',
        paymentRail: 'wise',
      },
      null
    );

    expect(stripe.state).toBe('linked');
    expect(
      paymentAccountLinkLabel({
        persistedState: stripe.state,
        persistedCode: stripe.persistedCode,
        draftCode: '1050',
      })
    ).toBe('linked');
    expect(wise.complete).toBe(false);
    expect(
      paymentAccountLinkLabel({
        persistedState: wise.state,
        persistedCode: wise.persistedCode,
        draftCode: null,
      })
    ).toBe('unresolved');
  });
});

describe('C. chart API failure does not clear mappings', () => {
  it('leaves Stripe/USDC/HBAR in place when the Xero chart cannot be loaded', () => {
    const result = prepareXeroMappingsForPersistence(stripeUsdcHbarMappings, {
      loaded: false,
      codes: null,
    });

    expect(result.skippedBecauseChartUnavailable).toBe(true);
    expect(result.clearedMappings).toEqual([]);
    expect(result.mappings.xero_stripe_clearing_account_id).toBe('1050');
    expect(result.mappings.xero_usdc_clearing_account_id).toBe('1052');
    expect(result.mappings.xero_hbar_clearing_account_id).toBe('1051');
  });
});

describe('D. a stale mapping only affects that rail', () => {
  it('does not disconnect invoice-ready accounting when one holding is stale', () => {
    const result = stripeUsdcHbarReadiness({
      mappings: {
        ...stripeUsdcHbarMappings,
        xero_usdt_clearing_account_id: '9999',
      },
    });

    expect(result.canSyncToAccounting).toBe(true);
    expect(result.connection.connected).toBe(true);
    expect(result.fieldStates.xero_usdt_clearing_account_id).toBe('needs_review');
    expect(result.fieldStates.xero_stripe_clearing_account_id).toBe('configured');
    expect(result.paymentAccountingStatus).toBe('partial');
  });
});

describe('E. existing invoice readiness still requires revenue + receivable in chart', () => {
  it('is not invoice-ready without a valid receivable mapping', () => {
    const result = stripeUsdcHbarReadiness({
      mappings: {
        ...stripeUsdcHbarMappings,
        xero_receivable_account_id: null,
      },
    });

    expect(result.canSyncToAccounting).toBe(false);
    expect(result.heroAnswer).toBe('Not yet');
  });

  it('is not invoice-ready when the chart cannot confirm invoice accounts', () => {
    const result = stripeUsdcHbarReadiness({
      chartLoaded: false,
      chartAccountCodes: null,
    });

    expect(result.canSyncToAccounting).toBe(false);
    expect(result.invoiceMappings.revenue.validInChart).toBe(false);
  });
});

describe('create-in-Xero failure copy is not a masked save error', () => {
  it('keeps the Xero account-creation reason instead of a generic mapping-save toast', () => {
    const xeroReason = 'Xero: Account code 1053 is not a valid code';
    const masked = formatMappingIssue(xeroReason);
    const actual = formatClearingAccountCreateFailures([
      { accountName: 'USDT Clearing', error: xeroReason },
    ]);

    expect(masked.message).toBe('One of the saved account choices is no longer valid in Xero.');
    expect(masked.action).toContain('save');
    expect(actual.message).toBe('1 holding account could not be added in Xero.');
    expect(actual.action).toContain('USDT Clearing');
    expect(actual.action).toContain(xeroReason);
  });
});
