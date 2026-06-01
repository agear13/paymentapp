import {
  manualPayoutMethodToPaymentLinkFields,
  normalizeManualPayoutMethod,
} from '@/lib/participants/manual-payout-method';

describe('participant manual payout method (1A)', () => {
  it('normalizes manual payout shape', () => {
    const method = normalizeManualPayoutMethod({
      type: 'manual',
      label: 'Revolut',
      instructions: 'Pay to @merchant',
      attachments: [{ label: 'QR', url: 'https://example.com/qr' }],
    });
    expect(method).toEqual({
      type: 'manual',
      label: 'Revolut',
      instructions: 'Pay to @merchant',
      attachments: [{ label: 'QR', url: 'https://example.com/qr' }],
    });
  });

  it('maps to payment link manual bank fields', () => {
    const fields = manualPayoutMethodToPaymentLinkFields(
      {
        type: 'manual',
        label: 'Revolut',
        instructions: 'Pay to @merchant',
      },
      'usd'
    );
    expect(fields.manual_bank_recipient_name).toBe('Revolut');
    expect(fields.manual_bank_currency).toBe('USD');
    expect(fields.manual_bank_instructions).toContain('Pay to @merchant');
  });
});
