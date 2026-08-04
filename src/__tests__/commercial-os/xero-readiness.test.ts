import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';

const DEFAULT_RAILS = {
  stripeEnabled: true,
  wiseEnabled: false,
  stablecoinSettlementsEnabled: false,
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
  });

  it('is ready_to_invoice when core accounts are saved and valid', () => {
    const result = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
      },
      chartAccountCodes: new Set(['200', '610']),
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });

    expect(result.overallStatus).toBe('ready_to_invoice');
    expect(result.canCreateInvoice).toBe(true);
    expect(result.blockers).toHaveLength(0);
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
    expect(result.statusLabel).toBe('Fully set up');
  });
});
