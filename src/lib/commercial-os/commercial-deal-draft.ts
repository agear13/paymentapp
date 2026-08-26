/**
 * Internal draft shape for commercial workflows.
 * Create Invoice is the first consumer; name stays generic for future reuse.
 */

import type { PaymentMethod } from '@prisma/client';

import type { PaymentCollectionMode } from '@/lib/payment-links/payment-collection-mode';

export type CommercialDealDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  invoiceReference: string;
  invoiceDate: Date;
  dueDate: Date | undefined;
  amount: number | undefined;
  currency: string;
  paymentCollectionMode: PaymentCollectionMode;
  paymentMethod: PaymentMethod | undefined;
};

/** Manual / blank Create Invoice. Invents a +14 day due date. Agreement-origin must not use this for due dates. */
export function defaultCommercialDealDraft(currency = 'AUD'): CommercialDealDraft {
  const invoiceDate = new Date();
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + 14);
  return {
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    description: '',
    invoiceReference: '',
    invoiceDate,
    dueDate,
    amount: undefined,
    currency,
    paymentCollectionMode: 'single',
    paymentMethod: undefined,
  };
}

/** Blank draft without an invented due date — used while agreement-origin prefill loads. */
export function agreementOriginCommercialDealDraft(currency = 'AUD'): CommercialDealDraft {
  return {
    ...defaultCommercialDealDraft(currency),
    dueDate: undefined,
  };
}
