/**
 * Xero Invoice Service
 * Creates invoices in Xero from payment links
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { Invoice, Contact, LineItem } from 'xero-node';
import { getFxService } from '@/lib/fx';
import type { Currency } from '@/lib/fx/types';

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

function roundXeroCurrencyRate(rate: number): number {
  return Math.round(rate * 1e6) / 1e6;
}

/**
 * Xero expects `CurrencyRate` = units of **organisation base currency** per **1 unit of invoice currency**
 * when `CurrencyCode` differs from the org base (e.g. USD invoice, AUD base).
 *
 * We prefer `payment_links.base_amount` / `amount` when `base_currency` matches reporting currency,
 * then FX (USDC→AUD as USD proxy), then a direct pair fetch when supported.
 */
async function resolveXeroCurrencyRate(params: {
  paymentLinkId: string;
  invoiceCurrency: string;
  reportingCurrency: string;
}): Promise<number> {
  const inv = params.invoiceCurrency.trim().toUpperCase();
  const rep = params.reportingCurrency.trim().toUpperCase();

  const pl = await prisma.payment_links.findUnique({
    where: { id: params.paymentLinkId },
    select: {
      amount: true,
      base_amount: true,
      base_currency: true,
    },
  });

  if (pl?.base_amount != null && pl.base_currency) {
    const baseCur = pl.base_currency.trim().toUpperCase();
    if (baseCur === rep) {
      const invAmt = Number(pl.amount);
      const baseAmt = Number(pl.base_amount);
      if (invAmt > 0 && baseAmt > 0 && Number.isFinite(invAmt) && Number.isFinite(baseAmt)) {
        const rate = baseAmt / invAmt;
        if (rate > 0 && Number.isFinite(rate)) {
          loggers.xero.info('xero_invoice_currency_rate_from_link_base_fields', {
            paymentLinkId: params.paymentLinkId,
            rate: roundXeroCurrencyRate(rate),
          });
          return roundXeroCurrencyRate(rate);
        }
      }
    }
  }

  const fx = getFxService();
  await fx.initialize();

  if (inv === 'USD' && rep === 'AUD') {
    const r = await fx.getRate('USDC', 'AUD');
    return roundXeroCurrencyRate(r.rate);
  }

  try {
    const r = await fx.getRate(inv as Currency, rep as Currency);
    return roundXeroCurrencyRate(r.rate);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not resolve an exchange rate from ${inv} to ${rep} for Xero (${msg}). ` +
        `Set Merchant Settings → default currency to your Xero base currency, or provide base_amount/base_currency on the payment link when invoicing in a foreign currency.`
    );
  }
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

  /**
   * Merchant reporting currency (Settings). When unset, assume it matches the invoice
   * so we do not invent a rate; set default_currency to your Xero org base (e.g. AUD).
   */
  const reportingCurrency = (settings.default_currency ?? currency).trim().toUpperCase();
  const invoiceCurrency = currency.trim().toUpperCase();

  let currencyRate: number | undefined;
  if (invoiceCurrency !== reportingCurrency) {
    loggers.xero.warn('Creating invoice in different currency than reporting', {
      invoiceCurrency,
      reportingCurrency,
      paymentLinkId,
      organizationId,
    });
    currencyRate = await resolveXeroCurrencyRate({
      paymentLinkId,
      invoiceCurrency,
      reportingCurrency,
    });
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
    currencyCode: invoiceCurrency as any, // Cast to match Xero SDK type
    ...(currencyRate != null ? { currencyRate } : {}),
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






