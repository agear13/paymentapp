import {
  computeCreateInvoiceWorkflowProgress,
  CREATE_INVOICE_NO_RAILS_MESSAGE,
  CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE,
  validateCreateInvoiceDraft,
  validateCreateInvoicePaymentRailReadiness,
  validateCreateInvoiceSubmitReadiness,
} from '@/lib/commercial-os/create-invoice-progress';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  computePaymentLinkRailSetup,
  toPaymentLinkRailSnapshot,
} from '@/lib/payment-links/setup-status';

function railSetupWith(input: {
  stripe?: boolean;
  wise?: boolean;
  hedera?: boolean;
  wiseGloballyEnabled?: boolean;
}) {
  return computePaymentLinkRailSetup(
    toPaymentLinkRailSnapshot({
      stripeAccountId: input.stripe ? 'acct_stripe_test' : null,
      hederaAccountId: input.hedera ? '0.0.12345' : null,
      wiseEnabled: input.wise ?? false,
      wiseProfileId: input.wise ? 'wise-profile' : null,
    }),
    {
      wisePayments: input.wiseGloballyEnabled ?? true,
      evmWalletPayments: false,
    }
  );
}

const completeDraft = {
  ...defaultCommercialDealDraft(),
  customerName: 'Beth',
  description: 'Campaign',
  amount: 2500,
};

describe('create-invoice-progress', () => {
  it('flags missing required fields', () => {
    const validation = validateCreateInvoiceDraft(defaultCommercialDealDraft());
    expect(validation.isSubmittable).toBe(false);
    expect(validation.missingLabels).toEqual([
      'Customer name or email',
      'Description',
      'Amount',
      'Payment method',
    ]);
  });

  it('accepts a complete draft (fields only)', () => {
    const validation = validateCreateInvoiceDraft({
      ...completeDraft,
      paymentMethod: 'STRIPE',
    });
    expect(validation.isSubmittable).toBe(true);
    expect(validation.missingLabels).toEqual([]);
  });

  it('advances workflow from Invoice to Payment to Settlement', () => {
    const empty = computeCreateInvoiceWorkflowProgress(defaultCommercialDealDraft());
    expect(empty[0]?.status).toBe('current');
    expect(empty[1]?.status).toBe('upcoming');

    const invoiceOnly = computeCreateInvoiceWorkflowProgress({
      ...defaultCommercialDealDraft(),
      customerName: 'Beth',
      description: 'Campaign',
      amount: 100,
    });
    expect(invoiceOnly[0]?.status).toBe('done');
    expect(invoiceOnly[1]?.status).toBe('current');

    const ready = computeCreateInvoiceWorkflowProgress({
      ...defaultCommercialDealDraft(),
      customerName: 'Beth',
      description: 'Campaign',
      amount: 100,
      paymentMethod: 'MANUAL_BANK',
    });
    expect(ready[0]?.status).toBe('done');
    expect(ready[1]?.status).toBe('done');
    expect(ready[2]?.status).toBe('current');
  });
});

describe('validateCreateInvoicePaymentRailReadiness', () => {
  it('allows Stripe when stripe_account_id is configured', () => {
    const railSetup = railSetupWith({ stripe: true });
    expect(railSetup.multiRails.stripe.configured).toBe(true);

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'STRIPE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );
    expect(result).toEqual({ ready: true });
  });

  it('blocks Stripe with per-method message when Stripe is not configured', () => {
    const railSetup = railSetupWith({ stripe: false });

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'STRIPE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );
    expect(result.ready).toBe(false);
    expect(result.blockMessage).toBe(CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE);
    expect(result.blockMessage).not.toBe(CREATE_INVOICE_NO_RAILS_MESSAGE);
  });

  it('uses per-method message for Stripe even when no rails are configured', () => {
    const railSetup = railSetupWith({ stripe: false });

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'STRIPE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );

    expect(result.blockMessage).toBe(CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE);
  });

  it('blocks Wise with per-method message when Wise is selected but not configured', () => {
    const railSetup = railSetupWith({ stripe: true, wise: false });

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'WISE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );

    expect(result.ready).toBe(false);
    expect(result.blockMessage).toBe(CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE);
  });

  it('blocks unconfigured Wise with per-method message even when no rails exist', () => {
    const railSetup = railSetupWith({ stripe: false, wise: false });

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'WISE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );

    expect(result.ready).toBe(false);
    expect(result.blockMessage).toBe(CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE);
  });

  it('allows manual bank when dedicated defaults are ready', () => {
    const railSetup = railSetupWith({ stripe: false });

    const result = validateCreateInvoicePaymentRailReadiness(
      { ...completeDraft, paymentMethod: 'MANUAL_BANK' },
      { railSetup, manualBankReady: true, cryptoReady: false }
    );

    expect(result).toEqual({ ready: true });
  });
});

describe('validateCreateInvoiceSubmitReadiness', () => {
  it('passes when Stripe is configured and draft is complete', () => {
    const railSetup = railSetupWith({ stripe: true });
    const result = validateCreateInvoiceSubmitReadiness(
      { ...completeDraft, paymentMethod: 'STRIPE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );

    expect(result.isSubmittable).toBe(true);
    expect(result.railReady).toBe(true);
    expect(result.submitBlockMessage).toBeUndefined();
  });

  it('blocks submit when Stripe is selected but not configured', () => {
    const railSetup = railSetupWith({ stripe: false });
    const result = validateCreateInvoiceSubmitReadiness(
      { ...completeDraft, paymentMethod: 'STRIPE' },
      { railSetup, manualBankReady: false, cryptoReady: false }
    );

    expect(result.isSubmittable).toBe(false);
    expect(result.railReady).toBe(false);
    expect(result.submitBlockMessage).toBe(CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE);
  });
});
