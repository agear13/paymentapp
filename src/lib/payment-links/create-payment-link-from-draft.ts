/**
 * Create payment link (invoice) — shared POST body for Commercial OS and legacy dialog.
 */

import type { CommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import {
  EntitlementRequiredError,
  parseEntitlementRequiredPayload,
} from '@/lib/entitlements/entitlement-api-errors';
import type {
  CryptoRailDefaults,
  ManualBankRailDefaults,
} from '@/lib/payment-links/merchant-dedicated-rail-defaults';
import { formatPaymentLinkApiValidationMessage } from '@/lib/payment-links/payment-link-api-validation-error';
import { PARTICIPANT_PORTAL_INVOICE_ORIGIN } from '@/lib/invoices/agreement-invoice-prefill';

export { EntitlementRequiredError } from '@/lib/entitlements/entitlement-api-errors';

export type CreatePaymentLinkResult = {
  id: string;
  invoiceReference?: string | null;
  shortCode?: string | null;
  amount?: number;
  currency?: string;
  description?: string;
  /** Server-stamped origin. Present only when participant-portal provenance resolved. */
  invoiceOrigin?: string | null;
};

export async function createPaymentLinkFromDraft(
  organizationId: string,
  draft: CommercialDealDraft,
  railDefaults?: {
    manualBank?: ManualBankRailDefaults | null;
    crypto?: CryptoRailDefaults | null;
  },
  originRequest?: {
    invoiceOrigin: typeof PARTICIPANT_PORTAL_INVOICE_ORIGIN;
    sourceParticipantId: string;
  }
): Promise<CreatePaymentLinkResult> {
  if (!draft.amount || draft.amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }
  if (!draft.description.trim()) {
    throw new Error('Add a description so your customer knows what this invoice is for.');
  }

  const mode = draft.paymentCollectionMode ?? 'single';
  if (mode === 'single' && !draft.paymentMethod) {
    throw new Error('Choose how your customer will pay.');
  }

  const body: Record<string, unknown> = {
    organizationId,
    amount: draft.amount,
    currency: draft.currency,
    invoiceCurrency: draft.currency,
    description: draft.description.trim(),
    invoiceReference: draft.invoiceReference.trim() || undefined,
    customerEmail: draft.customerEmail.trim() || undefined,
    customerName: draft.customerName.trim() || undefined,
    customerPhone: draft.customerPhone.trim() || undefined,
    invoiceDate: draft.invoiceDate.toISOString(),
    dueDate: draft.dueDate?.toISOString(),
    invoiceOnlyMode: mode === 'invoice_only',
    customerChoosesAtCheckout: mode === 'customer_choice',
  };
  // Agreement-origin invoices stay owned by the authenticated merchant org.
  // Do not set pilotDealId to an organiser-owned deal.
  // Origin IDs are never sent; the server derives provenance from the hint.
  if (
    originRequest?.invoiceOrigin === PARTICIPANT_PORTAL_INVOICE_ORIGIN &&
    originRequest.sourceParticipantId.trim()
  ) {
    body.invoiceOrigin = PARTICIPANT_PORTAL_INVOICE_ORIGIN;
    body.sourceParticipantId = originRequest.sourceParticipantId.trim();
  }

  if (mode === 'single' && draft.paymentMethod) {
    body.paymentMethod = draft.paymentMethod;
  }

  if (draft.paymentMethod === 'MANUAL_BANK' && railDefaults?.manualBank) {
    Object.assign(body, railDefaults.manualBank);
  }

  if (draft.paymentMethod === 'CRYPTO' && railDefaults?.crypto) {
    Object.assign(body, railDefaults.crypto);
  }

  const response = await fetch('/api/payment-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.json().catch(() => ({}));
    const entitlementPayload = parseEntitlementRequiredPayload(responseBody);
    if (entitlementPayload) {
      throw new EntitlementRequiredError(entitlementPayload);
    }
    const generic = responseBody as {
      error?: string;
      message?: string;
      details?: Array<{ field: string; message: string }>;
    };
    throw new Error(formatPaymentLinkApiValidationMessage(generic));
  }

  const result = (await response.json()) as { data: CreatePaymentLinkResult };
  return result.data;
}
