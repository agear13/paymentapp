export type PaymentLinkApiValidationDetail = {
  field: string;
  message: string;
};

type PaymentLinkApiErrorBody = {
  error?: string;
  message?: string;
  details?: PaymentLinkApiValidationDetail[];
};

/**
 * Prefer the first structured validation detail from POST/PATCH /api/payment-links.
 * Never surfaces raw request values — only server-provided messages.
 */
export function formatPaymentLinkApiValidationMessage(
  body: PaymentLinkApiErrorBody,
  fallback = 'Failed to create invoice. Please try again.'
): string {
  const details = body.details;
  if (Array.isArray(details) && details.length > 0) {
    const first = details[0];
    if (first?.message?.trim()) {
      return `Invoice could not be created: ${first.message}`;
    }
  }

  return body.message?.trim() || body.error?.trim() || fallback;
}
