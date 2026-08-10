import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';

const DEFAULT_RAILS = {
  stripeEnabled: true,
  wiseEnabled: false,
  stablecoinSettlementsEnabled: false,
  manualBankEnabled: false,
};

describe('computeXeroReadiness', () => {
  it('is setup_incomplete when not connected', () => {
    const result = computeXeroReadiness({
      status: { connected: false },
      mappings: null,
      chartAccountCodes: null,
      chartLoaded: false,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });

    expect(result.overallStatus).toBe('setup_incomplete');
    expect(result.canCreateInvoice).toBe(false);
    expect(result.statusLabel).toBe('Setup incomplete');
    expect(result.heroAnswer).toBe('Not yet');
    expect(result.heroSubline).toBe('Connect accounting to sync invoices automatically.');
    expect(result.blockers).toHaveLength(0);
  });

  it('is ready_to_invoice when core accounts and enabled rail holdings are configured', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '105',
      },
      chartAccountCodes: new Set(['200', '610', '105']),
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });

    expect(result.overallStatus).toBe('fully_set_up');
    expect(result.canCreateInvoice).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('does not allow invoicing when connected but chart failed to load', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '105',
      },
      chartAccountCodes: null,
      chartLoaded: false,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });

    expect(result.canCreateInvoice).toBe(false);
    expect(result.invoiceMappings.revenue.validInChart).toBe(false);
    expect(result.invoiceMappings.receivable.validInChart).toBe(false);
  });

  it('is fully_set_up when stripe holding account is configured', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
        xero_stripe_clearing_account_id: '105',
      },
      chartAccountCodes: new Set(['200', '610', '105']),
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });

    expect(result.overallStatus).toBe('fully_set_up');
    expect(result.statusLabel).toBe('All set');
  });
});
