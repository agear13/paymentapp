import fs from 'fs';
import path from 'path';
import {
  deriveCreateInvoiceFooterMessage,
  isCreateInvoicePaymentOptionReady,
  pickDefaultCreateInvoicePaymentMethod,
  validateCreateInvoiceSubmitReadiness,
} from '@/lib/commercial-os/create-invoice-progress';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';

const completeDraft = {
  ...defaultCommercialDealDraft(),
  customerName: 'Beth',
  description: 'Campaign',
  amount: 2500,
  paymentMethod: 'STRIPE' as const,
};

describe('create invoice payment selection helpers', () => {
  it('treats configured and available as ready', () => {
    expect(
      isCreateInvoicePaymentOptionReady({ value: 'STRIPE', available: true, configured: true })
    ).toBe(true);
    expect(
      isCreateInvoicePaymentOptionReady({ value: 'STRIPE', available: true, configured: false })
    ).toBe(false);
  });

  it('prefers the first configured payment option over merely selectable Stripe', () => {
    const options = [
      { value: 'STRIPE', available: true, configured: false },
      { value: 'WISE', available: true, configured: true },
    ];

    expect(pickDefaultCreateInvoicePaymentMethod(options)).toBe('WISE');
  });

  it('returns undefined when no payment option is ready', () => {
    const options = [
      { value: 'STRIPE', available: true, configured: false },
      { value: 'WISE', available: false, configured: false },
    ];

    expect(pickDefaultCreateInvoicePaymentMethod(options)).toBeUndefined();
  });
});

describe('deriveCreateInvoiceFooterMessage', () => {
  const railSetup = computePaymentLinkRailSetup(
    toPaymentLinkRailSnapshot({ stripeAccountId: null }),
    { wisePayments: true, evmWalletPayments: false }
  );

  it('shows blocked submission copy when fields are complete but rail is not ready', () => {
    const validation = validateCreateInvoiceSubmitReadiness(completeDraft, {
      railSetup,
      manualBankReady: false,
      cryptoReady: false,
    });

    expect(
      deriveCreateInvoiceFooterMessage({
        validation,
        formLoading: false,
        readyPaymentOptionCount: 1,
        showFieldErrors: false,
        progressiveGuidance: 'Review the preview, then create your invoice.',
      })
    ).toBe('Choose a ready payment method to create this invoice.');
  });

  it('shows setup guidance when fields are complete but no payment method is ready', () => {
    const validation = validateCreateInvoiceSubmitReadiness(completeDraft, {
      railSetup,
      manualBankReady: false,
      cryptoReady: false,
    });

    expect(
      deriveCreateInvoiceFooterMessage({
        validation,
        formLoading: false,
        readyPaymentOptionCount: 0,
        showFieldErrors: false,
        progressiveGuidance: 'Review the preview, then create your invoice.',
      })
    ).toBe('Set up a payment method before creating this invoice.');
  });

  it('shows missing fields after interaction without requiring a button click', () => {
    const validation = validateCreateInvoiceSubmitReadiness(defaultCommercialDealDraft(), {
      railSetup,
      manualBankReady: false,
      cryptoReady: false,
    });

    expect(
      deriveCreateInvoiceFooterMessage({
        validation,
        formLoading: false,
        readyPaymentOptionCount: 0,
        showFieldErrors: true,
        progressiveGuidance: 'Start with who you are billing.',
      })
    ).toContain('Complete required fields:');
  });
});

describe('create invoice mobile layout source', () => {
  it('keeps the form column before the preview sidebar in DOM order', () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'components',
        'journey',
        'lovable',
        'workspace-create-invoice-screen.tsx'
      ),
      'utf8'
    );

    const formIndex = source.indexOf('<div className="space-y-6">');
    const sidebarIndex = source.indexOf('<CreateInvoicePreviewSidebar');
    expect(formIndex).toBeGreaterThan(-1);
    expect(sidebarIndex).toBeGreaterThan(formIndex);
    expect(source).not.toMatch(/order-1 lg:order-2/);
  });
});
