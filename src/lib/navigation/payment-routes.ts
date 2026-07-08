/** Canonical operator payment / invoice CTAs (general workspace). */

export const CREATE_INVOICE_HREF = '/dashboard/payment-links?action=create';

/** Collection & settlement / merchant rail configuration (Wise, Stripe, etc.). */
export const COLLECTION_SETTLEMENT_SETTINGS_HREF = '/dashboard/settings/merchant';

export function createInvoiceHref(projectId?: string | null): string {
  const base = CREATE_INVOICE_HREF;
  if (!projectId?.trim()) return base;
  return `${base}&projectId=${encodeURIComponent(projectId.trim())}`;
}
