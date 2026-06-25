/**
 * Xero Supplier Bill Service
 *
 * Creates ACCPAY invoices (accounts payable / supplier bills) in Xero for
 * deal-network-pilot participants.
 *
 * This is distinct from the payment-link invoice service (ACCREC / accounts receivable).
 * Supplier bills represent money the operator OWES to participants.
 */
import 'server-only';
import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import type { PersistedDraftInvoice } from '@/lib/commercial/payment-setup-types';

export type SupplierBillInput = {
  organizationId: string;
  participant: {
    id: string;
    name: string;
    email: string | null;
  };
  invoice: PersistedDraftInvoice;
};

export type SupplierBillResult = {
  xeroContactId: string;
  xeroInvoiceId: string;
  xeroInvoiceNumber: string;
  status: string;
};

/**
 * Create or update a supplier bill (ACCPAY) in Xero for a participant.
 *
 * Creates:
 *   1. A Xero Contact for the supplier (upsert by name)
 *   2. A DRAFT ACCPAY Invoice (bill payable to the supplier)
 *
 * Returns the Xero contact ID, invoice ID, and invoice number.
 */
export async function createSupplierBillInXero(
  input: SupplierBillInput
): Promise<SupplierBillResult> {
  const { organizationId, participant, invoice } = input;

  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection found for this organization. Connect Xero first.');
  }

  const xero = getXeroClient();
  const { applyConnectionToXeroClient } = await import('./apply-connection-token-set');
  await applyConnectionToXeroClient(xero, connection, 'supplier_bill');
  await xero.updateTenants();

  const tenantId = connection.tenantId;

  /* ── 1. Upsert supplier contact ────────────────────────────────────────── */
  const contactPayload = {
    name: participant.name,
    emailAddress: participant.email ?? undefined,
    isSupplier: true,
  };

  const contactsResponse = await xero.accountingApi.createContacts(tenantId, {
    contacts: [contactPayload],
  });

  const contact = contactsResponse.body.contacts?.[0];
  if (!contact?.contactID) {
    throw new Error('Failed to create Xero contact for supplier');
  }

  /* ── 2. Build line items ─────────────────────────────────────────────── */
  const lineItems = invoice.lineItems.map((li) => ({
    description: li.description,
    quantity: li.quantity,
    unitAmount: li.unitAmount,
    taxType: li.taxType,
    accountCode: '200', // Default expense account — operator can remap in Xero settings
  }));

  /* ── 3. Create ACCPAY invoice (supplier bill) ──────────────────────────── */
  const invoicePayload = {
    type: 'ACCPAY' as const,
    contact: { contactID: contact.contactID },
    lineItems,
    date: new Date().toISOString().split('T')[0],
    dueDate: invoice.dueDate ?? undefined,
    status: 'DRAFT' as const,
    reference: invoice.agreementReference ?? `${invoice.projectName}`,
    lineAmountTypes: invoice.gstIncluded ? ('INCLUSIVE' as const) : ('EXCLUSIVE' as const),
    currencyCode: invoice.currency as unknown as undefined, // typed as CurrencyCode in xero-node
  };

  const invoicesResponse = await xero.accountingApi.createInvoices(tenantId, {
    invoices: [invoicePayload as never],
  });

  const xeroInvoice = invoicesResponse.body.invoices?.[0];
  if (!xeroInvoice?.invoiceID) {
    throw new Error('Failed to create Xero invoice for supplier');
  }

  return {
    xeroContactId: contact.contactID,
    xeroInvoiceId: xeroInvoice.invoiceID,
    xeroInvoiceNumber: xeroInvoice.invoiceNumber ?? xeroInvoice.invoiceID,
    // xeroInvoice.status is Invoice.StatusEnum (xero-node enum) — normalise to string
    status: xeroInvoice.status?.toString() ?? 'DRAFT',
  };
}
