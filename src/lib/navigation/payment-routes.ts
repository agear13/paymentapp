/** Canonical operator payment / invoice CTAs (general workspace). */

export const CREATE_INVOICE_HREF = '/dashboard/payment-links?action=create';

export function createInvoiceHref(projectId?: string | null): string {
  const base = CREATE_INVOICE_HREF;
  if (!projectId?.trim()) return base;
  return `${base}&projectId=${encodeURIComponent(projectId.trim())}`;
}
