import { resolvePaymentMethodForEvent } from '@/lib/services/payment-confirmation';
import { derivePaymentMethod } from '@/lib/xero/sync-orchestration';

describe('resolvePaymentMethodForEvent', () => {
  it('maps operator mark-paid to MANUAL', () => {
    expect(
      resolvePaymentMethodForEvent('manual', {
        settlementPath: 'operator_manual_invoice',
        source: 'manual-settlement-api',
      })
    ).toBe('MANUAL');
  });

  it('maps assisted bank review to MANUAL_BANK', () => {
    expect(
      resolvePaymentMethodForEvent('manual', {
        rail: 'MANUAL_BANK',
        settlementPath: 'assisted_review',
      })
    ).toBe('MANUAL_BANK');
  });

  it('maps assisted crypto review to CRYPTO', () => {
    expect(
      resolvePaymentMethodForEvent('manual', {
        rail: 'CRYPTO',
        settlementPath: 'assisted_review',
      })
    ).toBe('CRYPTO');
  });

  it('maps automated providers to their enum values', () => {
    expect(resolvePaymentMethodForEvent('stripe')).toBe('STRIPE');
    expect(resolvePaymentMethodForEvent('hedera')).toBe('HEDERA');
    expect(resolvePaymentMethodForEvent('wise')).toBe('WISE');
  });
});

describe('derivePaymentMethod (Xero)', () => {
  it('maps MANUAL event payment_method to WISE clearing', () => {
    expect(
      derivePaymentMethod(
        { payment_method: 'MANUAL', source_type: 'MANUAL' },
        null
      )
    ).toBe('WISE');
  });

  it('maps MANUAL_BANK to WISE', () => {
    expect(
      derivePaymentMethod(
        { payment_method: 'MANUAL_BANK', source_type: 'MANUAL' },
        null
      )
    ).toBe('WISE');
  });

  it('maps source_type MANUAL without payment_method to WISE', () => {
    expect(
      derivePaymentMethod({ payment_method: null, source_type: 'MANUAL' }, null)
    ).toBe('WISE');
  });
});
