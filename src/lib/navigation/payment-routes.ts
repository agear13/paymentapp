import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

/** Canonical operator payment / invoice CTAs (Commercial OS). */

export const CREATE_INVOICE_HREF = COMMERCIAL_OS_ROUTES.createInvoice;

export const INVOICE_LIST_HREF = COMMERCIAL_OS_ROUTES.invoiceList;

/** Collection & settlement / merchant rail configuration (Wise, Stripe, etc.). */
export const COLLECTION_SETTLEMENT_SETTINGS_HREF = '/dashboard/settings/merchant';

export function createInvoiceHref(_projectId?: string | null): string {
  // Receivables create does not read projectId / pilotDealId. Do not append an unused query.
  return CREATE_INVOICE_HREF;
}
