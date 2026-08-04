import {
  extractManualBankDefaults,
  isManualBankDefaultsComplete,
  resolveDedicatedRailDefaultsFromLinks,
} from '@/lib/payment-links/merchant-dedicated-rail-defaults';

describe('merchant dedicated rail defaults', () => {
  it('detects complete manual bank defaults', () => {
    expect(
      isManualBankDefaultsComplete({
        manualBankRecipientName: 'Acme Pty Ltd',
        manualBankCurrency: 'AUD',
        manualBankDestinationType: 'Australian bank account',
      })
    ).toBe(true);
  });

  it('resolves the newest complete manual bank link', () => {
    const result = resolveDedicatedRailDefaultsFromLinks([
      {
        paymentMethod: 'MANUAL_BANK',
        manualBankRecipientName: 'Old',
        manualBankCurrency: 'AUD',
        manualBankDestinationType: 'Bank',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        paymentMethod: 'MANUAL_BANK',
        manualBankRecipientName: 'Newest',
        manualBankCurrency: 'AUD',
        manualBankDestinationType: 'Bank',
        manualBankBankName: 'CBA',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ]);

    expect(result.manualBank?.manualBankRecipientName).toBe('Newest');
    expect(result.manualBank?.manualBankBankName).toBe('CBA');
  });

  it('returns null when manual bank fields are incomplete', () => {
    expect(
      extractManualBankDefaults({
        paymentMethod: 'MANUAL_BANK',
        manualBankRecipientName: 'Only name',
      })
    ).toBeNull();
  });
});
