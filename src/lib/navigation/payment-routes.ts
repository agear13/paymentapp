import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/** Canonical operator payment / invoice CTAs (Commercial OS). */

export const CREATE_INVOICE_HREF = COMMERCIAL_OS_ROUTES.createInvoice;

export const INVOICE_LIST_HREF = COMMERCIAL_OS_ROUTES.invoiceList;

/** Collection & settlement / merchant rail configuration (Wise, Stripe, etc.). */
export const COLLECTION_SETTLEMENT_SETTINGS_HREF = '/dashboard/settings/merchant';

export function createInvoiceHref(projectId?: string | null): string {
  const base = CREATE_INVOICE_HREF;
  if (!projectId?.trim()) return base;
  return `${base}&projectId=${encodeURIComponent(projectId.trim())}`;
}
