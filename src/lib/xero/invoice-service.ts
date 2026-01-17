/**
 * Xero Invoice Service
 * Creates invoices in Xero from payment links
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { prisma } from '@/lib/server/prisma';
import { Invoice, Contact, LineItem } from 'xero-node';

export interface InvoiceCreationParams {
  paymentLinkId: string;
  organizationId: string;
  amount: string;
  currency: string;
  description: string;
  customerEmail?: string;
  invoiceReference?: string;
}

export interface InvoiceCreationResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  total: number;
}

/**
 * Create invoice in Xero
 */
export async function createXeroInvoice(
  params: InvoiceCreationParams
): Promise<InvoiceCreationResult> {
  const {
    paymentLinkId,
    organizationId,
    amount,
    currency,
    description,
    customerEmail,
    invoiceReference,
  } = params;

  // Get Xero connection
  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection');
  }

  // Get account mappings
  const settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      xero_revenue_account_id: true,
      xero_receivable_account_id: true,
      default_currency: true,
    },
  });

  if (!settings?.xero_revenue_account_id) {
    throw new Error('Revenue account not mapped. Please configure Xero account mappings in Settings → Integrations.');
  }

  // Validate account code is not a UUID (common misconfiguration)
  const revenueAccountCode = settings.xero_revenue_account_id;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  
  if (uuidRegex.test(revenueAccountCode)) {
    throw new Error(
      `Invalid Xero account code: "${revenueAccountCode}". ` +
      `This appears to be an internal ID. Please set a valid Xero account code (e.g., "200", "400") in Settings → Integrations → Xero Account Mapping.`
    );
  }

  // Validate account code format (Xero codes are typically alphanumeric, max 10 chars)
  if (revenueAccountCode.length > 10) {
    throw new Error(
      `Invalid Xero account code: "${revenueAccountCode}". ` +
      `Xero account codes should be short alphanumeric values (e.g., "200", "400"). ` +
      `Please configure correct account codes in Settings → Integrations.`
    );
  }

  // Initialize Xero client
  const xeroClient = getXeroClient();
  await xeroClient.setTokenSet({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expires_at: connection.expiresAt.getTime(),
  });

  // Update tenants (read-only property, must use updateTenants method)
  await xeroClient.updateTenants();

  // Check if currency is supported by merchant's base currency
  // If trying to use a different currency, warn but allow it
  const baseCurrency = settings.default_currency || 'USD';
  if (currency !== baseCurrency) {
    loggers.xero.warn(
      'Creating invoice in different currency than base',
      {
        invoiceCurrency: currency,
        baseCurrency,
        paymentLinkId,
        organizationId,
      }
    );
  }

  // Get or create contact
  const contact = await getOrCreateContact(
    xeroClient,
    connection.tenantId,
    customerEmail || 'Cash Customer'
  );

  // Create invoice line items
  const lineItems: LineItem[] = [{
    description,
    quantity: 1,
    unitAmount: parseFloat(amount),
    accountCode: revenueAccountCode,
    taxType: 'EXEMPTOUTPUT', // GST-exempt output (sales) - valid for AU
  }];

  // Build invoice
  const invoice: Invoice = {
    type: Invoice.TypeEnum.ACCREC, // Accounts Receivable
    contact: { contactID: contact.contactID },
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0], // Due immediately
    lineItems,
    reference: invoiceReference || undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currencyCode: currency as any, // Cast to match Xero SDK type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    status: Invoice.StatusEnum.AUTHORISED as any, // Cast to match Xero SDK type
  };

  // Create invoice in Xero
  const response = await xeroClient.accountingApi.createInvoices(
    connection.tenantId,
    { invoices: [invoice] }
  );

  if (!response.body.invoices || response.body.invoices.length === 0) {
    throw new Error('Failed to create invoice in Xero');
  }

  const createdInvoice = response.body.invoices[0];

  return {
    invoiceId: createdInvoice.invoiceID!,
    invoiceNumber: createdInvoice.invoiceNumber!,
    status: String(createdInvoice.status!),
    total: createdInvoice.total!,
  };
}

/**
 * Get existing contact or create new one
 */
async function getOrCreateContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  xeroClient: any,
  tenantId: string,
  emailOrName: string
): Promise<Contact> {
  // Try to find existing contact
  try {
    const searchResponse = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined,
      `EmailAddress=="${emailOrName}" OR Name=="${emailOrName}"`
    );

    if (searchResponse.body.contacts && searchResponse.body.contacts.length > 0) {
      return searchResponse.body.contacts[0];
    }
  } catch (error) {
    console.log('Contact not found, will create new one');
  }

  // Create new contact
  const newContact: Contact = {
    name: emailOrName === 'Cash Customer' ? 'Cash Customer' : emailOrName,
    emailAddress: emailOrName.includes('@') ? emailOrName : undefined,
  };

  const createResponse = await xeroClient.accountingApi.createContacts(
    tenantId,
    { contacts: [newContact] }
  );

  if (!createResponse.body.contacts || createResponse.body.contacts.length === 0) {
    throw new Error('Failed to create contact in Xero');
  }

  return createResponse.body.contacts[0];
}






