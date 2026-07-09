/**
 * Xero Invoice Service
 * Creates invoices in Xero from payment links
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { Invoice, LineItem } from 'xero-node';
import { getOrCreateXeroContact, CASH_CUSTOMER_NAME } from './xero-contact-service';
import { getFxService } from '@/lib/fx';
import type { Currency } from '@/lib/fx/types';

import type { XeroExportContext } from './xero-layer-export';
import {
  buildXeroInvoiceReference,
  enrichXeroLineDescription,
} from './xero-layer-export';

export interface InvoiceCreationParams {
  paymentLinkId: string;
  organizationId: string;
  amount: string;
  currency: string;
  description: string;
  customerEmail?: string;
  invoiceReference?: string;
  /** When set, accounting layer drives posting values and FX snapshot immutability. */
  exportContext?: XeroExportContext;
}

export interface InvoiceCreationResult {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  total: number;
  /** Raw Xero API invoices payload (for audit / debugging). */
  xeroRawInvoicesResponse?: unknown;
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
  /** When accounting layer is active, use immutable snapshot only — never live rates. */
  exportContext?: XeroExportContext;
}): Promise<number> {
  const inv = params.invoiceCurrency.trim().toUpperCase();
  const rep = params.reportingCurrency.trim().toUpperCase();

  if (params.exportContext?.posting.usesAccountingLayer) {
    if (inv === rep) {
      return 1;
    }
    const snapshotRate = params.exportContext.accountingFxRate;
    if (snapshotRate != null && snapshotRate > 0) {
      loggers.xero.info('xero_invoice_currency_rate_from_accounting_snapshot', {
        paymentLinkId: params.paymentLinkId,
        fxSnapshotId: params.exportContext.fxSnapshotId,
        rate: roundXeroCurrencyRate(snapshotRate),
      });
      return roundXeroCurrencyRate(snapshotRate);
    }
    const commercial = Number(params.exportContext.metadata.commercialAmount);
    const accounting = Number(params.exportContext.metadata.accountingAmount);
    if (commercial > 0 && accounting > 0) {
      const derived = accounting / commercial;
      loggers.xero.info('xero_invoice_currency_rate_from_layer_amounts', {
        paymentLinkId: params.paymentLinkId,
        rate: roundXeroCurrencyRate(derived),
      });
      return roundXeroCurrencyRate(derived);
    }
    throw new Error(
      `Accounting layer is active but no immutable FX snapshot exists for ${inv} → ${rep}. ` +
        `Ensure an ACCOUNTING FX snapshot was captured at invoice creation.`
    );
  }

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
    exportContext,
  } = params;

  const postingAmount = exportContext?.posting.amount ?? amount;
  const postingCurrency = exportContext?.posting.currency ?? currency;
  const usesAccountingLayer = exportContext?.posting.usesAccountingLayer ?? false;

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
  const { applyConnectionToXeroClient } = await import('./apply-connection-token-set');
  await applyConnectionToXeroClient(xeroClient, connection, 'create_invoice');

  // Update tenants (read-only property, must use updateTenants method)
  await xeroClient.updateTenants();

  /**
   * Merchant reporting currency (Settings). When unset, assume it matches the invoice
   * so we do not invent a rate; set default_currency to your Xero org base (e.g. AUD).
   */
  const reportingCurrency = (settings.default_currency ?? postingCurrency).trim().toUpperCase();
  const invoiceCurrency = postingCurrency.trim().toUpperCase();

  let currencyRate: number | undefined;
  if (invoiceCurrency !== reportingCurrency) {
    loggers.xero.warn('Creating invoice in different currency than reporting', {
      invoiceCurrency,
      reportingCurrency,
      paymentLinkId,
      organizationId,
      usesAccountingLayer,
    });
    currencyRate = await resolveXeroCurrencyRate({
      paymentLinkId,
      invoiceCurrency,
      reportingCurrency,
      exportContext,
    });
  }

  const lineDescription =
    exportContext && usesAccountingLayer
      ? enrichXeroLineDescription(description, exportContext.metadata, usesAccountingLayer)
      : description;

  const xeroReference =
    exportContext != null
      ? buildXeroInvoiceReference({
          invoiceReference,
          paymentLinkId,
          metadata: exportContext.metadata,
          usesAccountingLayer,
        })
      : invoiceReference || undefined;

  // Get or create contact
  const contact = await getOrCreateXeroContact({
    organizationId,
    xeroClient,
    tenantId: connection.tenantId,
    emailOrName: customerEmail || CASH_CUSTOMER_NAME,
  });

  // Create invoice line items
  const lineItems: LineItem[] = [{
    description: lineDescription,
    quantity: 1,
    unitAmount: parseFloat(postingAmount),
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
    reference: xeroReference,
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

  const invoiceId = createdInvoice.invoiceID?.trim();
  const invoiceNumber = createdInvoice.invoiceNumber?.trim();
  if (!invoiceId || !invoiceNumber) {
    loggers.xero.error(
      {
        paymentLinkId,
        organizationId,
        xeroResponseInvoices: response.body.invoices,
      },
      'createInvoices: missing invoiceID or invoiceNumber in Xero response'
    );
    throw new Error('Xero did not return a valid invoice ID and number');
  }

  loggers.xero.info(
    {
      paymentLinkId,
      organizationId,
      invoiceId,
      invoiceNumber,
      status: createdInvoice.status,
    },
    'Xero ACCREC created'
  );

  return {
    invoiceId,
    invoiceNumber,
    status: String(createdInvoice.status!),
    total: createdInvoice.total!,
    xeroRawInvoicesResponse: response.body.invoices,
  };
}



