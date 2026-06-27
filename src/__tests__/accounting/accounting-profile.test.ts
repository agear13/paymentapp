import {
  evaluateAccountingProfile,
  type AccountingProfile,
} from '@/lib/accounting/accounting-profile';

const baseProfile: AccountingProfile = {
  provider: 'xero',
  connection: {
    connected: true,
    tenantId: 'tenant-1',
  },
  accounts: {
    revenue: '400',
    accountsReceivable: '120',
    processorFees: '610',
    stripeClearing: '105',
    settlementAccounts: {},
  },
  gst: {
    configured: true,
  },
};

describe('AccountingProfile health', () => {
  it('is healthy when required and recommended standard accounts are configured', () => {
    const health = evaluateAccountingProfile(baseProfile);

    expect(health.status).toBe('healthy');
    expect(health.title).toBe('Ready for Production');
  });

  it('is ready with recommendations when optional accounts are missing', () => {
    const health = evaluateAccountingProfile({
      ...baseProfile,
      accounts: {
        ...baseProfile.accounts,
        processorFees: null,
        stripeClearing: null,
      },
    });

    expect(health.status).toBe('ready_with_recommendations');
    expect(health.title).toBe('Ready with Recommendations');
  });

  it('requires attention when invoice export would fail', () => {
    const health = evaluateAccountingProfile({
      ...baseProfile,
      accounts: {
        ...baseProfile.accounts,
        revenue: null,
      },
    });

    expect(health.status).toBe('attention_required');
    expect(health.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Revenue account',
          status: 'attention',
        }),
      ])
    );
  });

  it('requires attention when Xero connection is lost', () => {
    const health = evaluateAccountingProfile({
      ...baseProfile,
      connection: {
        connected: false,
        operatorMessage: 'Reconnect Xero',
      },
    });

    expect(health.status).toBe('attention_required');
  });
});
