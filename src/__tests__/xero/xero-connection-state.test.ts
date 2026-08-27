import {
  computeXeroConnectionState,
  presentXeroConnectionState,
} from '@/lib/xero/xero-connection-state';
import { computeXeroReadiness } from '@/lib/commercial-os/xero-readiness';

const DEFAULT_RAILS = {
  stripeEnabled: true,
  wiseEnabled: false,
  stablecoinSettlementsEnabled: false,
  manualBankEnabled: false,
};

describe('computeXeroConnectionState', () => {
  it('is DISCONNECTED when no connection exists', () => {
    expect(computeXeroConnectionState({ connected: false })).toBe('DISCONNECTED');
  });

  it('is AUTH_REAUTH_REQUIRED when refresh token is invalid', () => {
    expect(
      computeXeroConnectionState({
        connected: true,
        stale: true,
        tenantId: 'tenant-1',
        invoiceMappingsComplete: true,
      })
    ).toBe('AUTH_REAUTH_REQUIRED');
  });

  it('is ACCOUNT_MAPPINGS_REQUIRED when OAuth is healthy and mappings are missing', () => {
    expect(
      computeXeroConnectionState({
        connected: true,
        tenantId: 'tenant-1',
        invoiceMappingsComplete: false,
      })
    ).toBe('ACCOUNT_MAPPINGS_REQUIRED');
  });

  it('is READY when OAuth is healthy and invoice mappings are complete', () => {
    expect(
      computeXeroConnectionState({
        connected: true,
        tenantId: 'tenant-1',
        invoiceMappingsComplete: true,
      })
    ).toBe('READY');
  });

  it('is ERROR for an internal refresh implementation failure without marking reauth', () => {
    expect(
      computeXeroConnectionState({
        connected: true,
        tenantId: 'tenant-1',
        internalFailure: true,
        invoiceMappingsComplete: true,
      })
    ).toBe('ERROR');
  });

  it('does not treat broken OAuth as Ready even when mappings are complete', () => {
    const state = computeXeroConnectionState({
      connected: true,
      reauthorizationRequired: true,
      tenantId: 'tenant-1',
      invoiceMappingsComplete: true,
    });
    expect(state).toBe('AUTH_REAUTH_REQUIRED');
    expect(presentXeroConnectionState(state).badgeLabel).not.toBe('Connected');
  });
});

describe('canonical Xero UI presentation', () => {
  it('renders the same card and banner state for incomplete mappings', () => {
    const readiness = computeXeroReadiness({
      status: { connected: true, tenantId: 'tenant-1' },
      mappings: null,
      chartAccountCodes: null,
      chartLoaded: false,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });
    const presentation = presentXeroConnectionState(readiness.connection.connectionState);

    expect(readiness.connection.connectionState).toBe('ACCOUNT_MAPPINGS_REQUIRED');
    expect(presentation.badgeLabel).toBe('Connected');
    expect(presentation.detail).toBe('Setup incomplete');
    expect(presentation.ctaLabel).toBe('Continue setup');
    expect(presentation.bannerTitle).toBe('Accounting connected');
  });

  it('renders the same card and banner state for reauthorization', () => {
    const readiness = computeXeroReadiness({
      status: {
        connected: true,
        tenantId: 'tenant-1',
        stale: true,
        reauthorizationRequired: true,
      },
      mappings: {
        xero_revenue_account_id: '200',
        xero_receivable_account_id: '610',
      },
      chartAccountCodes: new Set(['200', '610']),
      chartLoaded: true,
      queue: { pendingCount: 0, hasRecentFailures: false },
      merchantRails: DEFAULT_RAILS,
    });
    const presentation = presentXeroConnectionState(readiness.connection.connectionState);

    expect(readiness.canSyncToAccounting).toBe(false);
    expect(readiness.connection.connectionState).toBe('AUTH_REAUTH_REQUIRED');
    expect(presentation.badge).toBe('action_required');
    expect(presentation.ctaLabel).toBe('Reconnect');
    expect(presentation.bannerTitle).toBe('Xero authorization expired');
  });

  it('renders Ready when OAuth and invoice mappings are complete', () => {
    const readiness = computeXeroReadiness({
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
    const presentation = presentXeroConnectionState(readiness.connection.connectionState);

    expect(readiness.connection.connectionState).toBe('READY');
    expect(presentation.badgeLabel).toBe('Connected');
    expect(presentation.detail).toBe('Ready to sync');
    expect(presentation.ctaLabel).toBe('Manage');
  });
});
