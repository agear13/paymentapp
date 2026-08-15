/**
 * Create Invoice workflow progress — display-only, derived from draft state.
 */

import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  getOperationalMultiCheckoutOptions,
  type OperationalPaymentOptionLike,
} from '@/lib/payment-links/payment-collection-mode';
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
  'Set up this payment method in Payment settings before creating this invoice.';

export const CREATE_INVOICE_CUSTOMER_CHOICE_RAILS_MESSAGE =
  'Set up at least one payment method in Payment settings before offering customer choice at checkout.';

export const CREATE_INVOICE_SINGLE_METHOD_MESSAGE =
  'Choose a payment method for this invoice.';

export const CREATE_INVOICE_NO_RAILS_MESSAGE =
  'Set up at least one payment method in Payment settings before creating this invoice.';

export type CreateInvoicePaymentOptionLike = {
  value: string;
  available: boolean;
  configured: boolean;
};

export function isCreateInvoicePaymentOptionReady(opt: CreateInvoicePaymentOptionLike): boolean {
  return opt.available && opt.configured;
}

export function pickDefaultCreateInvoicePaymentMethod<T extends CreateInvoicePaymentOptionLike>(
  options: readonly T[]
): T['value'] | undefined {
  return options.find(isCreateInvoicePaymentOptionReady)?.value;
}

export function isCreateInvoicePaymentMethodSelectionReady(
  options: readonly CreateInvoicePaymentOptionLike[],
  paymentMethod: string | null | undefined
): boolean {
  if (!paymentMethod) return false;
  const selected = options.find((opt) => opt.value === paymentMethod);
  return selected ? isCreateInvoicePaymentOptionReady(selected) : false;
}

export function areCreateInvoiceFieldsSubmittable(
  validation: Pick<
    CreateInvoiceSubmitValidation,
    'customer' | 'description' | 'amount' | 'paymentMethod'
  >
): boolean {
  return (
    validation.customer &&
    validation.description &&
    validation.amount &&
    validation.paymentMethod
  );
}

export function deriveCreateInvoiceFooterMessage(input: {
  validation: CreateInvoiceSubmitValidation;
  formLoading: boolean;
  readyPaymentOptionCount: number;
  showFieldErrors: boolean;
  progressiveGuidance: string;
}): string {
  const {
    validation,
    formLoading,
    readyPaymentOptionCount,
    showFieldErrors,
    progressiveGuidance,
  } = input;

  if (formLoading) {
    return 'Loading payment settings…';
  }

  const fieldsSubmittable = areCreateInvoiceFieldsSubmittable(validation);

  if (fieldsSubmittable && !validation.railReady) {
    if (readyPaymentOptionCount > 0) {
      return 'Choose a ready payment method to create this invoice.';
    }
    return 'Set up a payment method before creating this invoice.';
  }

  if (showFieldErrors && !fieldsSubmittable && validation.missingLabels.length > 0) {
    return `Complete required fields: ${validation.missingLabels.join(', ')}.`;
  }

  return progressiveGuidance;
}

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
  const mode = draft.paymentCollectionMode ?? 'single';
  const hasPaymentMethod =
    mode === 'invoice_only' ||
    mode === 'customer_choice' ||
    Boolean(draft.paymentMethod);

  const missingLabels: string[] = [];
  if (!hasCustomer) missingLabels.push('Customer name or email');
  if (!hasDescription) missingLabels.push('Description');
  if (!hasAmount) missingLabels.push('Amount');
  if (mode === 'single' && !draft.paymentMethod) missingLabels.push('Payment method');

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
    paymentMethodOptions?: readonly CreateInvoicePaymentOptionLike[];
  }
): CreateInvoiceRailReadiness {
  const mode = draft.paymentCollectionMode ?? 'single';

  if (mode === 'invoice_only') {
    return { ready: true };
  }

  if (mode === 'customer_choice') {
    const readyMulti = getOperationalMultiCheckoutOptions(input.paymentMethodOptions ?? []);
    if (readyMulti.length === 0) {
      return { ready: false, blockMessage: CREATE_INVOICE_CUSTOMER_CHOICE_RAILS_MESSAGE };
    }
    return { ready: true };
  }

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
    paymentMethodOptions?: readonly CreateInvoicePaymentOptionLike[];
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
  const paymentDone =
    validation.paymentMethod &&
    (draft.paymentCollectionMode === 'customer_choice' ||
      draft.paymentCollectionMode === 'invoice_only' ||
      Boolean(draft.paymentMethod));

  let currentIndex = 0;
  if (invoiceDone && !paymentDone) currentIndex = 1;
  else if (invoiceDone && paymentDone) currentIndex = 2;

  return CREATE_INVOICE_WORKFLOW_STEPS.map((label, index) => ({
    label,
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming',
  }));
}
