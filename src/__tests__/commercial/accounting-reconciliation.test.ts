import {
  reconcileSupplierInvoiceToObligations,
  type InvoiceBackedObligationLine,
} from '@/lib/commercial/accounting-reconciliation';
import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

function makeInvoice(overrides: Partial<PersistedDraftInvoice> = {}): PersistedDraftInvoice {
  return {
    id: 'inv-1',
    createdAt: '2026-06-01T00:00:00.000Z',
    status: 'APPROVED',
    supplier: 'Supplier Pty Ltd',
    participantId: 'participant-1',
    agreementReference: 'AGR-1',
    projectName: 'Project',
    description: 'Supplier services',
    currency: 'AUD',
    subtotal: 1000,
    gstAmount: 100,
    total: 1100,
    gstIncluded: true,
    gstStatus: 'yes',
    dueDate: null,
    lineItems: [
      {
        description: 'Supplier services',
        quantity: 1,
        unitAmount: 1000,
        taxType: 'INPUT',
      },
    ],
    ...overrides,
  };
}

function reconcile(lines: InvoiceBackedObligationLine[], invoice = makeInvoice()) {
  return reconcileSupplierInvoiceToObligations({
    invoice,
    obligationLines: lines,
  });
}

describe('reconcileSupplierInvoiceToObligations', () => {
  it('passes perfect reconciliation', () => {
    const result = reconcile([
      { id: 'obl-1', amount: 1100, currency: 'AUD', invoiceBacked: true },
    ]);

    expect(result.status).toBe('passed');
    expect(result.varianceClass).toBe('none');
    expect(result.releaseAllowed).toBe(true);
    expect(result.varianceAmount).toBe(0);
  });

  it('allows explicitly explained partial settlement variance', () => {
    const result = reconcile([
      {
        id: 'obl-1',
        amount: 550,
        currency: 'AUD',
        invoiceBacked: true,
        varianceClass: 'partial_settlement',
      },
    ]);

    expect(result.status).toBe('warning');
    expect(result.varianceClass).toBe('partial_settlement');
    expect(result.releaseAllowed).toBe(true);
  });

  it('allows explicitly explained adjustment variance', () => {
    const result = reconcile([
      {
        id: 'obl-1',
        amount: 1050,
        currency: 'AUD',
        invoiceBacked: true,
        varianceClass: 'adjustment',
      },
    ]);

    expect(result.status).toBe('warning');
    expect(result.varianceClass).toBe('adjustment');
    expect(result.releaseAllowed).toBe(true);
  });

  it('allows explicitly explained bonus variance', () => {
    const result = reconcile([
      { id: 'obl-1', amount: 1100, currency: 'AUD', invoiceBacked: true },
      {
        id: 'obl-2',
        amount: 200,
        currency: 'AUD',
        invoiceBacked: true,
        varianceClass: 'bonus',
      },
    ]);

    expect(result.status).toBe('warning');
    expect(result.varianceClass).toBe('bonus');
    expect(result.releaseAllowed).toBe(true);
  });

  it('allows explicitly explained clawback variance', () => {
    const result = reconcile([
      { id: 'obl-1', amount: 1100, currency: 'AUD', invoiceBacked: true },
      {
        id: 'obl-2',
        amount: -150,
        currency: 'AUD',
        invoiceBacked: true,
        varianceClass: 'clawback',
      },
    ]);

    expect(result.status).toBe('warning');
    expect(result.varianceClass).toBe('clawback');
    expect(result.releaseAllowed).toBe(true);
  });

  it('allows non-invoiceable obligation variance when marked', () => {
    const result = reconcile([
      { id: 'obl-1', amount: 1100, currency: 'AUD', invoiceBacked: true },
      {
        id: 'obl-2',
        amount: 75,
        currency: 'AUD',
        invoiceBacked: false,
        varianceClass: 'non_invoiceable_obligation',
      },
    ]);

    expect(result.status).toBe('warning');
    expect(result.varianceClass).toBe('non_invoiceable_obligation');
    expect(result.releaseAllowed).toBe(true);
    expect(result.nonInvoiceableObligationsTotal).toBe(75);
  });

  it('blocks unexpected variance', () => {
    const result = reconcile([
      { id: 'obl-1', amount: 900, currency: 'AUD', invoiceBacked: true },
    ]);

    expect(result.status).toBe('blocked');
    expect(result.varianceClass).toBe('unknown_variance');
    expect(result.releaseAllowed).toBe(false);
    expect(result.reason).toContain('Unexplained variance');
  });
});
