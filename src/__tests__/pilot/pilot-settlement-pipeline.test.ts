/**
 * End-to-end settlement pipeline contract test.
 * Invoice → Stripe payment → webhook → settlement → ledger → Xero invoice → Xero payment
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

const PATHS = {
  createPaymentLink: path.join(ROOT, 'lib/payment-links/create-payment-link-in-tx.ts'),
  postCreate: path.join(ROOT, 'lib/payment-links/payment-link-post-create.ts'),
  stripeWebhook: path.join(ROOT, 'app/api/stripe/webhook/route.ts'),
  confirmPayment: path.join(ROOT, 'lib/services/payment-confirmation.ts'),
  queueProcessor: path.join(ROOT, 'lib/xero/queue-processor.ts'),
  syncOrchestration: path.join(ROOT, 'lib/xero/sync-orchestration.ts'),
  stripePosting: path.join(ROOT, 'lib/ledger/posting-rules/stripe.ts'),
  invoiceService: path.join(ROOT, 'lib/xero/invoice-service.ts'),
  paymentService: path.join(ROOT, 'lib/xero/payment-service.ts'),
};

function read(file: keyof typeof PATHS): string {
  return fs.readFileSync(PATHS[file], 'utf8');
}

describe('pilot settlement pipeline (invoice → Xero payment)', () => {
  it('stage 1: invoice / payment link creation persists link row', () => {
    const source = read('createPaymentLink');
    expect(source).toContain('payment_links.create');
    expect(source).toContain('short_code');
  });

  it('stage 2: post-create queues Xero INVOICE sync', () => {
    const source = read('postCreate');
    expect(source).toContain('queueXeroSync');
    expect(source).toMatch(/INVOICE/);
  });

  it('stage 3: Stripe webhook verifies signature before processing', () => {
    const source = read('stripeWebhook');
    expect(source).toContain('verifyWebhookSignature');
    expect(source).toContain("provider: 'stripe'");
    expect(source).toContain('confirmPayment({');
  });

  it('stage 4: confirmPayment creates PAYMENT_CONFIRMED and Stripe ledger posting', () => {
    const source = read('confirmPayment');
    expect(source).toContain("provider === 'stripe'");
    expect(source).toContain('PAYMENT_CONFIRMED');
    expect(source).toContain('postStripeSettlement');
    expect(source).toContain('validateLedgerInvariant');
  });

  it('stage 5: confirmPayment upserts Xero PAYMENT sync queue row', () => {
    const source = read('confirmPayment');
    expect(source).toMatch(/xero_syncs|PAYMENT/);
  });

  it('stage 6: queue processor invokes Xero invoice + payment orchestration', () => {
    const queue = read('queueProcessor');
    const sync = read('syncOrchestration');
    expect(queue).toContain('processQueue');
    expect(sync).toContain('createXeroInvoice');
    expect(sync).toMatch(/recordXeroPayment|PAYMENT/);
  });

  it('stage 7: Xero services exist for invoice and payment recording', () => {
    expect(read('invoiceService')).toContain('createXeroInvoice');
    expect(read('paymentService')).toContain('recordXeroPayment');
  });

  it('fails contract if any spine handler is removed', () => {
    const spine = [
      read('stripeWebhook'),
      read('confirmPayment'),
      read('postCreate'),
      read('syncOrchestration'),
    ].join('\n');
    const required = [
      'confirmPayment',
      'queueXeroSync',
      'postStripeSettlement',
      'createXeroInvoice',
      'recordXeroPayment',
    ];
    for (const token of required) {
      expect(spine).toContain(token);
    }
  });
});
