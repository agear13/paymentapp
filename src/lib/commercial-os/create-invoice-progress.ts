/**
 * Create Invoice workflow progress — display-only, derived from draft state.
 */

import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  CRYPTO_UNAVAILABLE_REASON,
  MANUAL_BANK_UNAVAILABLE_REASON,
} from '@/lib/payment-links/merchant-dedicated-rail-defaults';
import {
  guardrailKindForUnconfiguredPaymentMethod,
  type PaymentLinkRailSetupStatus,
} from '@/lib/payment-links/setup-status';

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

export const CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE =
  'The selected payment method is not fully set up yet. Check Connected Systems.';

export const CREATE_INVOICE_NO_RAILS_MESSAGE =
  'Connect Stripe or Wise in Connected Systems, or choose Manual Bank Transfer or Crypto to create this invoice.';

export type CreateInvoiceRailReadiness = {
  ready: boolean;
  blockMessage?: string;
};

export type CreateInvoiceSubmitValidation = CreateInvoiceFieldValidation & {
  railReady: boolean;
  submitBlockMessage?: string;
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

export function validateCreateInvoicePaymentRailReadiness(
  draft: CommercialDealDraft,
  input: {
    railSetup: PaymentLinkRailSetupStatus;
    manualBankReady: boolean;
    cryptoReady: boolean;
  }
): CreateInvoiceRailReadiness {
  const pm = draft.paymentMethod;

  if (pm === 'MANUAL_BANK' && !input.manualBankReady) {
    return { ready: false, blockMessage: MANUAL_BANK_UNAVAILABLE_REASON };
  }

  if (pm === 'CRYPTO' && !input.cryptoReady) {
    return { ready: false, blockMessage: CRYPTO_UNAVAILABLE_REASON };
  }

  if (pm && pm !== 'CRYPTO' && pm !== 'MANUAL_BANK') {
    const guardrailKind = guardrailKindForUnconfiguredPaymentMethod(pm, input.railSetup);
    if (guardrailKind) {
      return {
        ready: false,
        blockMessage: CREATE_INVOICE_PAYMENT_METHOD_NOT_READY_MESSAGE,
      };
    }

    if (!input.railSetup.anyRailConfigured) {
      return { ready: false, blockMessage: CREATE_INVOICE_NO_RAILS_MESSAGE };
    }
  }

  return { ready: true };
}

export function validateCreateInvoiceSubmitReadiness(
  draft: CommercialDealDraft,
  input: {
    railSetup: PaymentLinkRailSetupStatus;
    manualBankReady: boolean;
    cryptoReady: boolean;
  }
): CreateInvoiceSubmitValidation {
  const fields = validateCreateInvoiceDraft(draft);
  const rail = validateCreateInvoicePaymentRailReadiness(draft, input);

  return {
    ...fields,
    railReady: rail.ready,
    submitBlockMessage: rail.ready ? undefined : rail.blockMessage,
    isSubmittable: fields.isSubmittable && rail.ready,
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
