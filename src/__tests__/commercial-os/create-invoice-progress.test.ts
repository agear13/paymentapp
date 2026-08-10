import {
  computeCreateInvoiceWorkflowProgress,
  validateCreateInvoiceDraft,
} from '@/lib/commercial-os/create-invoice-progress';
import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';

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

  it('accepts a complete draft', () => {
    const validation = validateCreateInvoiceDraft({
      ...defaultCommercialDealDraft(),
      customerName: 'Beth',
      description: 'Campaign',
      amount: 2500,
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
