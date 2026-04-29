/**
 * Invoice / accounting denomination for a payment link (amount on the invoice,
 * Stripe charge currency, Xero ACCREC, AR ledger, public pay page "currency").
 *
 * This is intentionally **not** derived from payment rail (HBAR, USDC, card, Wise).
 */
export function invoiceDenominationCurrency(link: {
  invoice_currency?: string | null;
  currency: string;
}): string {
  return (link.invoice_currency ?? link.currency).trim().toUpperCase();
}
