/**
 * Create Invoice workflow progress — display-only, derived from draft state.
 */

import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';

export const CREATE_INVOICE_WORKFLOW_STEPS = [
  'Invoice',
  'Payment',
  'Settlement',
  'Ledger',
] as const;

export type CreateInvoiceWorkflowStep = (typeof CREATE_INVOICE_WORKFLOW_STEPS)[number];

export type CreateInvoiceWorkflowStepState = {
  label: CreateInvoiceWorkflowStep;
  status: 'done' | 'current' | 'upcoming';
};

export type CreateInvoiceFieldValidation = {
  customer: boolean;
  description: boolean;
  amount: boolean;
  paymentMethod: boolean;
  isSubmittable: boolean;
  missingLabels: string[];
};

export function validateCreateInvoiceDraft(draft: CommercialDealDraft): CreateInvoiceFieldValidation {
  const hasCustomer = Boolean(draft.customerName.trim() || draft.customerEmail.trim());
  const hasDescription = Boolean(draft.description.trim());
  const hasAmount = typeof draft.amount === 'number' && draft.amount > 0;
  const hasPaymentMethod = Boolean(draft.paymentMethod);

  const missingLabels: string[] = [];
  if (!hasCustomer) missingLabels.push('Customer name or email');
  if (!hasDescription) missingLabels.push('Description');
  if (!hasAmount) missingLabels.push('Amount');
  if (!hasPaymentMethod) missingLabels.push('Payment method');

  return {
    customer: hasCustomer,
    description: hasDescription,
    amount: hasAmount,
    paymentMethod: hasPaymentMethod,
    isSubmittable: hasCustomer && hasDescription && hasAmount && hasPaymentMethod,
    missingLabels,
  };
}

export function computeCreateInvoiceWorkflowProgress(
  draft: CommercialDealDraft
): CreateInvoiceWorkflowStepState[] {
  const validation = validateCreateInvoiceDraft(draft);
  const invoiceDone = validation.customer && validation.description && validation.amount;
  const paymentDone = validation.paymentMethod;

  let currentIndex = 0;
  if (invoiceDone && !paymentDone) currentIndex = 1;
  else if (invoiceDone && paymentDone) currentIndex = 2;

  return CREATE_INVOICE_WORKFLOW_STEPS.map((label, index) => ({
    label,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
  }));
}
