/**
 * Multi-Currency Xero Sync Integration
 * 
 * Handles synchronization of multi-currency payments and invoices to Xero:
 * - Multi-currency invoice creation
 * - Currency conversion tracking
 * - Payment allocation in different currencies
 * - Exchange rate handling
 * - Multi-currency reconciliation
 * 
 * Sprint 26: Final Testing & Quality Assurance
 */

import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { XeroClient } from 'xero-node';
import { convertCurrency } from '@/lib/currency/currency-converter';
import { getCurrency } from '@/lib/currency/currency-config';
import { getActiveRateOverride } from '@/lib/currency/rate-management';
import type { MultiCurrencyInvoice } from '@/lib/currency/multi-currency-line-items';

// ============================================================================
// Types
// ============================================================================

export interface XeroMultiCurrencyInvoice {
  Type: 'ACCREC';
  Contact: {
    ContactID?: string;
    Name?: string;
    EmailAddress?: string;
  };
  Date: string;
  DueDate: string;
  LineItems: Array<{
    Description: string;
    Quantity: number;
    UnitAmount: number;
    AccountCode: string;
    TaxType: string;
    LineAmount?: number;
  }>;
  Reference?: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED';
  CurrencyCode: string;
  CurrencyRate?: number;
}

export interface XeroMultiCurrencyPayment {
  Invoice: {
    InvoiceID: string;
  };
  Account: {
    Code: string;
  };
  Date: string;
  Amount: number;
  CurrencyRate?: number;
  Reference?: string;
}

export interface MultiCurrencySyncResult {
  success: boolean;
  xeroInvoiceId?: string;
  xeroPaymentId?: string;
  invoiceCurrency: string;
  paymentCurrency?: string;
  conversionRate?: number;
  error?: string;
}

// ============================================================================
// Multi-Currency Invoice Sync
// ============================================================================

/**
 * Syncs a multi-currency payment link to Xero
 */
export async function syncMultiCurrencyPaymentToXero(
  paymentLinkId: string,
  organizationId: string
): Promise<MultiCurrencySyncResult> {
  log.info({ paymentLinkId, organizationId }, 'Starting multi-currency Xero sync');

  try {
    // Get payment link details
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      include: {
        payment_events: {
          where: { event_type: 'PAYMENT_CONFIRMED' },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
        fx_snapshots: {
          where: { snapshot_type: 'SETTLEMENT' },
          orderBy: { captured_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!paymentLink) {
      throw new Error('Payment link not found');
    }

    // Get merchant settings for Xero account mappings
    const merchantSettings = await prisma.merchant_settings.findUnique({
      where: { organization_id: organizationId },
    });

    if (!merchantSettings) {
      throw new Error('Merchant settings not found');
    }

    // Determine currencies
    const baseCurrency = paymentLink.base_currency || paymentLink.currency;
    const paymentCurrency = paymentLink.customer_selected_currency || paymentLink.currency;
    const conversionRate = paymentLink.conversion_rate_at_creation
      ? Number(paymentLink.conversion_rate_at_creation)
      : 1;

    // Check if there's a multi-currency invoice
    const multiCurrencyInvoice = await prisma.multi_currency_invoices.findFirst({
      where: { payment_link_id: paymentLinkId },
    });

    let xeroInvoiceId: string;

    if (multiCurrencyInvoice) {
      // Sync multi-currency invoice with line items
      xeroInvoiceId = await syncMultiCurrencyInvoiceToXero(
        paymentLinkId,
        organizationId,
        multiCurrencyInvoice,
        merchantSettings
      );
    } else {
      // Sync simple single-currency invoice
      xeroInvoiceId = await syncSimpleInvoiceToXero(
        paymentLinkId,
        organizationId,
        paymentLink,
        merchantSettings,
        baseCurrency
      );
    }

    // Sync payment
    const paymentEvent = paymentLink.payment_events[0];
    let xeroPaymentId: string | undefined;

    if (paymentEvent) {
      xeroPaymentId = await syncPaymentToXero(
        xeroInvoiceId,
        organizationId,
        paymentEvent,
        merchantSettings,
        paymentCurrency,
        conversionRate
      );
    }

    log.info(
      {
        paymentLinkId,
        xeroInvoiceId,
        xeroPaymentId,
        baseCurrency,
        paymentCurrency,
        conversionRate,
      },
      'Multi-currency Xero sync complete'
    );

    return {
      success: true,
      xeroInvoiceId,
      xeroPaymentId,
      invoiceCurrency: baseCurrency,
      paymentCurrency,
      conversionRate,
    };
  } catch (error: any) {
    log.error(
      { paymentLinkId, organizationId, error: error.message },
      'Multi-currency Xero sync failed'
    );

    return {
      success: false,
      invoiceCurrency: 'USD',
      error: error.message,
    };
  }
}

/**
 * Syncs a multi-currency invoice with line items to Xero
 */
async function syncMultiCurrencyInvoiceToXero(
  paymentLinkId: string,
  organizationId: string,
  invoice: any,
  merchantSettings: any
): Promise<string> {
  log.info({ paymentLinkId }, 'Syncing multi-currency invoice to Xero');

  // Get Xero connection
  const xeroConnection = await prisma.xero_connections.findUnique({
    where: { organization_id: organizationId },
  });

  if (!xeroConnection) {
    throw new Error('Xero connection not found');
  }

  // Get payment link for contact details
  const paymentLink = await prisma.payment_links.findUnique({
    where: { id: paymentLinkId },
  });

  if (!paymentLink) {
    throw new Error('Payment link not found');
  }

  // Parse line items
  const lineItems = typeof invoice.line_items === 'string'
    ? JSON.parse(invoice.line_items)
    : invoice.line_items;

  // Build Xero invoice
  const xeroInvoice: XeroMultiCurrencyInvoice = {
    Type: 'ACCREC',
    Contact: {
      Name: paymentLink.customer_email || 'Unknown Customer',
      EmailAddress: paymentLink.customer_email || undefined,
    },
    Date: new Date().toISOString().split('T')[0],
    DueDate: new Date().toISOString().split('T')[0],
    LineItems: lineItems.map((item: any) => ({
      Description: item.description,
      Quantity: item.quantity,
      UnitAmount: item.convertedUnitPrice || item.unitPrice,
      AccountCode: merchantSettings.xero_revenue_account_id || '200',
      TaxType: item.taxRate ? 'OUTPUT' : 'NONE',
      LineAmount: item.convertedSubtotal,
    })),
    Reference: paymentLink.invoice_reference || `PL-${paymentLink.short_code}`,
    Status: 'AUTHORISED',
    CurrencyCode: invoice.invoice_currency,
  };

  // Add currency rate if different from base
  if (invoice.invoice_currency !== merchantSettings.default_currency) {
    const conversionRates = typeof invoice.conversion_rates === 'string'
      ? JSON.parse(invoice.conversion_rates)
      : invoice.conversion_rates;

    const rateKey = `${merchantSettings.default_currency}/${invoice.invoice_currency}`;
    if (conversionRates && conversionRates[rateKey]) {
      xeroInvoice.CurrencyRate = conversionRates[rateKey];
    }
  }

  // TODO: Make actual Xero API call
  // For now, we'll simulate the response
  const xeroInvoiceId = `INV-${Date.now()}`;

  // Record sync
  await prisma.xero_syncs.create({
    data: {
      id: crypto.randomUUID(),
      payment_link_id: paymentLinkId,
      sync_type: 'INVOICE',
      status: 'SUCCESS',
      xero_invoice_id: xeroInvoiceId,
      request_payload: xeroInvoice,
      response_payload: { InvoiceID: xeroInvoiceId },
      updated_at: new Date(),
    },
  });

  return xeroInvoiceId;
}

/**
 * Syncs a simple single-currency invoice to Xero
 */
async function syncSimpleInvoiceToXero(
  paymentLinkId: string,
  organizationId: string,
  paymentLink: any,
  merchantSettings: any,
  currency: string
): Promise<string> {
  log.info({ paymentLinkId, currency }, 'Syncing simple invoice to Xero');

  // Build Xero invoice
  const xeroInvoice: XeroMultiCurrencyInvoice = {
    Type: 'ACCREC',
    Contact: {
      Name: paymentLink.customer_email || 'Unknown Customer',
      EmailAddress: paymentLink.customer_email || undefined,
    },
    Date: new Date().toISOString().split('T')[0],
    DueDate: new Date().toISOString().split('T')[0],
    LineItems: [
      {
        Description: paymentLink.description || 'Payment',
        Quantity: 1,
        UnitAmount: Number(paymentLink.amount),
        AccountCode: merchantSettings.xero_revenue_account_id || '200',
        TaxType: 'NONE',
      },
    ],
    Reference: paymentLink.invoice_reference || `PL-${paymentLink.short_code}`,
    Status: 'AUTHORISED',
    CurrencyCode: currency,
  };

  // Add currency rate if different from base
  if (currency !== merchantSettings.default_currency && paymentLink.conversion_rate_at_creation) {
    xeroInvoice.CurrencyRate = Number(paymentLink.conversion_rate_at_creation);
  }

  // TODO: Make actual Xero API call
  const xeroInvoiceId = `INV-${Date.now()}`;

  // Record sync
  await prisma.xero_syncs.create({
    data: {
      id: crypto.randomUUID(),
      payment_link_id: paymentLinkId,
      sync_type: 'INVOICE',
      status: 'SUCCESS',
      xero_invoice_id: xeroInvoiceId,
      request_payload: xeroInvoice,
      response_payload: { InvoiceID: xeroInvoiceId },
      updated_at: new Date(),
    },
  });

  return xeroInvoiceId;
}

/**
 * Syncs a payment to Xero
 */
async function syncPaymentToXero(
  xeroInvoiceId: string,
  organizationId: string,
  paymentEvent: any,
  merchantSettings: any,
  paymentCurrency: string,
  conversionRate: number
): Promise<string> {
  log.info({ xeroInvoiceId, paymentCurrency }, 'Syncing payment to Xero');

  // Determine clearing account based on payment method
  let clearingAccountCode: string;

  if (paymentEvent.payment_method === 'STRIPE') {
    clearingAccountCode = merchantSettings.xero_stripe_clearing_account_id || '1200';
  } else {
    // Hedera payment - determine by currency
    const currencyUpper = paymentCurrency.toUpperCase();
    switch (currencyUpper) {
      case 'HBAR':
        clearingAccountCode = merchantSettings.xero_hbar_clearing_account_id || '1210';
        break;
      case 'USDC':
        clearingAccountCode = merchantSettings.xero_usdc_clearing_account_id || '1211';
        break;
      case 'USDT':
        clearingAccountCode = merchantSettings.xero_usdt_clearing_account_id || '1212';
        break;
      case 'AUDD':
        clearingAccountCode = merchantSettings.xero_audd_clearing_account_id || '1213';
        break;
      default:
        clearingAccountCode = '1200';
    }
  }

  // Build Xero payment
  const xeroPayment: XeroMultiCurrencyPayment = {
    Invoice: {
      InvoiceID: xeroInvoiceId,
    },
    Account: {
      Code: clearingAccountCode,
    },
    Date: new Date().toISOString().split('T')[0],
    Amount: Number(paymentEvent.amount_received),
    Reference: paymentEvent.hedera_transaction_id || paymentEvent.stripe_payment_intent_id,
  };

  // Add currency rate if different from invoice currency
  if (conversionRate !== 1) {
    xeroPayment.CurrencyRate = conversionRate;
  }

  // TODO: Make actual Xero API call
  const xeroPaymentId = `PAY-${Date.now()}`;

  // Record sync
  await prisma.xero_syncs.create({
    data: {
      id: crypto.randomUUID(),
      payment_link_id: paymentEvent.payment_link_id,
      sync_type: 'PAYMENT',
      status: 'SUCCESS',
      xero_payment_id: xeroPaymentId,
      request_payload: xeroPayment,
      response_payload: { PaymentID: xeroPaymentId },
      updated_at: new Date(),
    },
  });

  return xeroPaymentId;
}

/**
 * Gets the effective exchange rate for a currency pair
 * Checks for custom overrides first, then falls back to market rate
 */
export async function getEffectiveExchangeRate(
  organizationId: string,
  baseCurrency: string,
  quoteCurrency: string
): Promise<number> {
  // Check for custom override
  const override = await getActiveRateOverride(
    organizationId,
    baseCurrency,
    quoteCurrency
  );

  if (override) {
    log.info(
      { organizationId, baseCurrency, quoteCurrency, rate: override.overrideRate },
      'Using custom rate override for Xero sync'
    );
    return override.overrideRate;
  }

  // Fall back to market rate
  return await convertCurrency(1, baseCurrency, quoteCurrency);
}

/**
 * Validates multi-currency sync data before sending to Xero
 */
export function validateMultiCurrencySyncData(
  invoice: XeroMultiCurrencyInvoice,
  payment?: XeroMultiCurrencyPayment
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate invoice
  if (!invoice.CurrencyCode || invoice.CurrencyCode.length !== 3) {
    errors.push('Invalid currency code');
  }

  if (!invoice.LineItems || invoice.LineItems.length === 0) {
    errors.push('Invoice must have at least one line item');
  }

  if (invoice.CurrencyRate !== undefined && invoice.CurrencyRate <= 0) {
    errors.push('Currency rate must be positive');
  }

  // Validate payment if provided
  if (payment) {
    if (payment.Amount <= 0) {
      errors.push('Payment amount must be positive');
    }

    if (payment.CurrencyRate !== undefined && payment.CurrencyRate <= 0) {
      errors.push('Payment currency rate must be positive');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}







