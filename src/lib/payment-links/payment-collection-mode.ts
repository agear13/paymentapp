import type { PaymentMethod } from '@prisma/client';

import { getMultiCheckoutRails } from '@/lib/payments/payment-rail-registry';

/** How the merchant configures payment collection on a new invoice. */
export type PaymentCollectionMode = 'single' | 'customer_choice' | 'invoice_only';

export const INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL = 'Customer chooses at checkout';

export const MULTI_CHECKOUT_PAYMENT_METHODS: readonly PaymentMethod[] =
  getMultiCheckoutRails().map((rail) => rail.paymentMethod);

export function isMultiCheckoutPaymentMethod(method: PaymentMethod): boolean {
  return MULTI_CHECKOUT_PAYMENT_METHODS.includes(method);
}

export function formatInvoicePaymentMethodLabel(input: {
  paymentMethod?: string | null;
  invoiceOnlyMode?: boolean;
}): string {
  if (input.invoiceOnlyMode) return 'Invoice only';
  if (!input.paymentMethod) return INVOICE_PAYMENT_METHOD_CUSTOMER_CHOICE_LABEL;
  return input.paymentMethod;
}

export type OperationalPaymentOptionLike = {
  value: string;
  available: boolean;
  configured: boolean;
};

/** Multi-checkout rails that are configured and operational for this merchant. */
export function getOperationalMultiCheckoutOptions<T extends OperationalPaymentOptionLike>(
  options: readonly T[]
): T[] {
  const multiSet = new Set<string>(MULTI_CHECKOUT_PAYMENT_METHODS);
  return options.filter(
    (opt) => multiSet.has(opt.value) && opt.available && opt.configured
  );
}
