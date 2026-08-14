import {
  isWiseCheckoutOperational,
  isWiseInvoiceMethodAvailable,
  WISE_AUTO_SETTLEMENT_UNAVAILABLE_REASON,
  WISE_INVOICE_UNAVAILABLE_WHEN_AUTO_OFF,
} from '@/lib/payments/wise-bank-transfer-ux';
import { buildInvoicePaymentMethodOptions } from '@/lib/payments/payment-rail-merchant-readiness';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';

describe('wise-bank-transfer-ux gating', () => {
  it('requires wisePayments and wiseAutoSettlementAvailable for checkout', () => {
    expect(
      isWiseCheckoutOperational({ wisePayments: true, wiseAutoSettlementAvailable: true })
    ).toBe(true);
    expect(
      isWiseCheckoutOperational({ wisePayments: true, wiseAutoSettlementAvailable: false })
    ).toBe(false);
    expect(
      isWiseCheckoutOperational({ wisePayments: false, wiseAutoSettlementAvailable: true })
    ).toBe(false);
  });

  it('matches invoice method availability to checkout operational state', () => {
    expect(isWiseInvoiceMethodAvailable({ wisePayments: true, wiseAutoSettlementAvailable: false }))
      .toBe(false);
  });
});

describe('buildInvoicePaymentMethodOptions Wise rail', () => {
  const setup = computePaymentLinkRailSetup(
    toPaymentLinkRailSnapshot({
      stripeAccountId: 'acct_1',
      wiseEnabled: true,
      wiseProfileId: '12345',
    }),
    { wisePayments: true, evmWalletPayments: false }
  );

  it('marks WISE unavailable when auto-settlement is off', () => {
    const options = buildInvoicePaymentMethodOptions({
      setup,
      features: { wisePayments: true, wiseAutoSettlementAvailable: false },
    });

    const wise = options.find((o) => o.value === 'WISE');
    const manualBank = options.find((o) => o.value === 'MANUAL_BANK');

    expect(wise?.available).toBe(false);
    expect(wise?.unavailableReason).toBe(WISE_INVOICE_UNAVAILABLE_WHEN_AUTO_OFF);
    expect(manualBank?.available).toBe(true);
    expect(manualBank?.label).toBe('Bank transfer (manual verification)');
  });

  it('marks WISE available when auto-settlement is on and profile configured', () => {
    const options = buildInvoicePaymentMethodOptions({
      setup,
      features: { wisePayments: true, wiseAutoSettlementAvailable: true },
    });

    const wise = options.find((o) => o.value === 'WISE');
    expect(wise?.available).toBe(true);
    expect(wise?.label).toBe('Wise bank transfer (automated checkout — pilot)');
  });

  it('does not claim automatic detection in unavailable copy', () => {
    expect(WISE_AUTO_SETTLEMENT_UNAVAILABLE_REASON).toMatch(/manual verification/i);
    expect(WISE_AUTO_SETTLEMENT_UNAVAILABLE_REASON).not.toMatch(/automatically detect/i);
    expect(WISE_INVOICE_UNAVAILABLE_WHEN_AUTO_OFF).toMatch(/manual verification/i);
  });
});
