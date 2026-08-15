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
