import {
  buildMappingFieldStates,
  chartAccountCodeSet,
  computeHeroSubline,
  filterPostConnectSyncs,
  resolveMappingDisplayState,
  shouldShowPastPayments,
} from '@/lib/commercial-os/xero-invoice-readiness';
import type { MerchantPaymentRails } from '@/lib/xero/xero-setup-guidance';

const DEFAULT_RAILS: MerchantPaymentRails = {
  stripeEnabled: false,
  wiseEnabled: false,
  stablecoinSettlementsEnabled: false,
  manualBankEnabled: false,
};

describe('resolveMappingDisplayState', () => {
  it('returns required when empty and required', () => {
    expect(resolveMappingDisplayState(null, true, new Set(), true)).toBe('required');
  });

  it('returns recommended when empty and optional', () => {
    expect(resolveMappingDisplayState(null, true, new Set(), false)).toBe('recommended');
  });

  it('returns needs_review when code missing from chart', () => {
    expect(resolveMappingDisplayState('999', true, new Set(['200']), true)).toBe('needs_review');
  });

  it('returns configured when code exists in chart', () => {
    expect(resolveMappingDisplayState('200', true, new Set(['200']), true)).toBe('configured');
  });

  it('does not treat a saved code as configured until the chart confirms it', () => {
    expect(resolveMappingDisplayState('200', false, null, true)).toBe('required');
    expect(resolveMappingDisplayState('200', false, null, false)).toBe('recommended');
  });

  it('trims chart codes when building the lookup set', () => {
    expect(chartAccountCodeSet([{ code: ' 200 ', status: 'ACTIVE' }]).has('200')).toBe(true);
    expect(chartAccountCodeSet([{ code: '200', status: 'ARCHIVED' }]).has('200')).toBe(false);
  });
});

describe('filterPostConnectSyncs', () => {
  const connectedAt = '2026-01-01T00:00:00.000Z';

  it('returns only active syncs after connect', () => {
    const syncs = [
      {
        id: '1',
        payment_link_id: 'pl_1',
        sync_type: 'payment',
        status: 'PENDING',
        retry_count: 0,
        error_message: null,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: '2',
        payment_link_id: 'pl_2',
        sync_type: 'payment',
        status: 'PENDING',
        retry_count: 0,
        error_message: null,
        created_at: '2025-12-01T00:00:00.000Z',
        updated_at: '2025-12-01T00:00:00.000Z',
      },
      {
        id: '3',
        payment_link_id: 'pl_3',
        sync_type: 'payment',
        status: 'SUCCESS',
        retry_count: 0,
        error_message: null,
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    expect(filterPostConnectSyncs(syncs, connectedAt)).toHaveLength(1);
    expect(filterPostConnectSyncs(syncs, connectedAt)[0]?.id).toBe('1');
  });

  it('returns empty when connectedAt is missing', () => {
    expect(filterPostConnectSyncs([], null)).toEqual([]);
  });
});

describe('shouldShowPastPayments', () => {
  it('is true when post-connect active syncs exist', () => {
    const connectedAt = '2026-01-01T00:00:00.000Z';
    const syncs = [
      {
        id: '1',
        payment_link_id: 'pl_1',
        sync_type: 'payment',
        status: 'FAILED',
        retry_count: 1,
        error_message: 'error',
        created_at: '2026-01-02T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ];

    expect(shouldShowPastPayments(syncs, connectedAt)).toBe(true);
  });
});

describe('computeHeroSubline', () => {
  it('prompts to connect when disconnected', () => {
    expect(
      computeHeroSubline({
        connected: false,
        tenantSelected: false,
        canSendInvoices: false,
        settlementReady: false,
        fieldStates: {},
      })
    ).toBe('Connect accounting to sync invoices automatically.');
  });

  it('prompts to choose accounts when connected but not ready', () => {
    const fieldStates = buildMappingFieldStates(
      { xero_revenue_account_id: null, xero_receivable_account_id: null },
      true,
      new Set(),
      DEFAULT_RAILS
    );

    expect(
      computeHeroSubline({
        connected: true,
        tenantSelected: true,
        canSendInvoices: false,
        settlementReady: true,
        fieldStates,
      })
    ).toBe('Choose where invoices are recorded in Xero — open "Where invoices go" below.');
  });

  it('marks settlement fields as required when rails are enabled', () => {
    const fieldStates = buildMappingFieldStates(
      {},
      true,
      new Set(),
      { ...DEFAULT_RAILS, stripeEnabled: true, manualBankEnabled: true }
    );

    expect(fieldStates.xero_stripe_clearing_account_id).toBe('required');
    expect(fieldStates.xero_wise_clearing_account_id).toBe('required');
    expect(fieldStates.xero_fee_expense_account_id).toBe('recommended');
  });
});
