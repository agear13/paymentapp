/**
 * Multi-Currency Line Items Support
 * 
 * Handles invoices with line items in different currencies:
 * - Mixed currency line items
 * - Automatic conversion to invoice currency
 * - Subtotal/tax/total calculation
 * - Rate snapshot preservation
 * 
 * Sprint 25: Multi-Currency Enhancement
 */

import { convertCurrency } from './currency-converter';
import { getCurrency } from './currency-config';
import { log } from '@/lib/logger';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  taxRate?: number; // Percentage (e.g., 10 for 10%)
  metadata?: Record<string, any>;
}

export interface ConvertedLineItem extends LineItem {
  convertedUnitPrice: number;
  convertedSubtotal: number;
  conversionRate: number;
  invoiceCurrency: string;
}

export interface MultiCurrencyInvoice {
  invoiceCurrency: string;
  lineItems: ConvertedLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  conversionRates: Record<string, number>; // currency pair -> rate
  createdAt: Date;
}

export interface InvoiceCalculationOptions {
  roundingMode?: 'up' | 'down' | 'nearest';
  preserveOriginalAmounts?: boolean;
  applyTaxPerLine?: boolean;
}

/**
 * Creates a multi-currency invoice from line items
 */
export async function createMultiCurrencyInvoice(
  lineItems: LineItem[],
  invoiceCurrency: string,
  options: InvoiceCalculationOptions = {}
): Promise<MultiCurrencyInvoice> {
  const {
    roundingMode = 'nearest',
    preserveOriginalAmounts = true,
    applyTaxPerLine = true,
  } = options;

  log.info(
    { lineItemCount: lineItems.length, invoiceCurrency },
    'Creating multi-currency invoice'
  );

  // Convert all line items to invoice currency
  const convertedItems: ConvertedLineItem[] = [];
  const conversionRates: Record<string, number> = {};

  for (const item of lineItems) {
    let convertedUnitPrice: number;
    let conversionRate: number;

    if (item.currency === invoiceCurrency) {
      convertedUnitPrice = item.unitPrice;
      conversionRate = 1;
    } else {
      convertedUnitPrice = await convertCurrency(
        item.unitPrice,
        item.currency,
        invoiceCurrency
      );
      conversionRate = convertedUnitPrice / item.unitPrice;
      
      // Store the conversion rate for this pair
      const pairKey = `${item.currency}/${invoiceCurrency}`;
      conversionRates[pairKey] = conversionRate;
    }

    const convertedSubtotal = convertedUnitPrice * item.quantity;

    convertedItems.push({
      ...item,
      convertedUnitPrice,
      convertedSubtotal,
      conversionRate,
      invoiceCurrency,
    });
  }

  // Calculate totals
  const subtotal = convertedItems.reduce(
    (sum, item) => sum + item.convertedSubtotal,
    0
  );

  let taxAmount = 0;
  if (applyTaxPerLine) {
    // Calculate tax per line item
    taxAmount = convertedItems.reduce((sum, item) => {
      if (item.taxRate) {
        return sum + (item.convertedSubtotal * item.taxRate) / 100;
      }
      return sum;
    }, 0);
  } else {
    // Apply a single tax rate to the subtotal (would need to be passed in options)
    // For now, we'll sum up individual line item taxes
    taxAmount = convertedItems.reduce((sum, item) => {
      if (item.taxRate) {
        return sum + (item.convertedSubtotal * item.taxRate) / 100;
      }
      return sum;
    }, 0);
  }

  const totalAmount = subtotal + taxAmount;

  // Apply rounding based on invoice currency
  const invoiceCurrencyConfig = getCurrency(invoiceCurrency);
  const decimals = invoiceCurrencyConfig?.decimalDigits ?? 2;

  const roundedSubtotal = roundAmount(subtotal, decimals, roundingMode);
  const roundedTaxAmount = roundAmount(taxAmount, decimals, roundingMode);
  const roundedTotalAmount = roundAmount(totalAmount, decimals, roundingMode);

  log.info(
    {
      subtotal: roundedSubtotal,
      taxAmount: roundedTaxAmount,
      totalAmount: roundedTotalAmount,
      currencyPairs: Object.keys(conversionRates).length,
    },
    'Multi-currency invoice created'
  );

  return {
    invoiceCurrency,
    lineItems: convertedItems,
    subtotal: roundedSubtotal,
    taxAmount: roundedTaxAmount,
    totalAmount: roundedTotalAmount,
    conversionRates,
    createdAt: new Date(),
  };
}

/**
 * Adds a line item to an existing invoice
 */
export async function addLineItem(
  invoice: MultiCurrencyInvoice,
  lineItem: LineItem,
  options: InvoiceCalculationOptions = {}
): Promise<MultiCurrencyInvoice> {
  const allLineItems = [
    ...invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
      taxRate: item.taxRate,
      metadata: item.metadata,
    })),
    lineItem,
  ];

  return createMultiCurrencyInvoice(
    allLineItems,
    invoice.invoiceCurrency,
    options
  );
}

/**
 * Removes a line item from an existing invoice
 */
export async function removeLineItem(
  invoice: MultiCurrencyInvoice,
  lineItemId: string,
  options: InvoiceCalculationOptions = {}
): Promise<MultiCurrencyInvoice> {
  const remainingLineItems = invoice.lineItems
    .filter((item) => item.id !== lineItemId)
    .map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
      taxRate: item.taxRate,
      metadata: item.metadata,
    }));

  if (remainingLineItems.length === 0) {
    throw new Error('Cannot remove last line item from invoice');
  }

  return createMultiCurrencyInvoice(
    remainingLineItems,
    invoice.invoiceCurrency,
    options
  );
}

/**
 * Updates a line item quantity or price
 */
export async function updateLineItem(
  invoice: MultiCurrencyInvoice,
  lineItemId: string,
  updates: Partial<Pick<LineItem, 'quantity' | 'unitPrice' | 'description' | 'taxRate'>>,
  options: InvoiceCalculationOptions = {}
): Promise<MultiCurrencyInvoice> {
  const updatedLineItems = invoice.lineItems.map((item) => {
    if (item.id === lineItemId) {
      return {
        id: item.id,
        description: updates.description ?? item.description,
        quantity: updates.quantity ?? item.quantity,
        unitPrice: updates.unitPrice ?? item.unitPrice,
        currency: item.currency,
        taxRate: updates.taxRate ?? item.taxRate,
        metadata: item.metadata,
      };
    }
    return {
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      currency: item.currency,
      taxRate: item.taxRate,
      metadata: item.metadata,
    };
  });

  return createMultiCurrencyInvoice(
    updatedLineItems,
    invoice.invoiceCurrency,
    options
  );
}

/**
 * Converts an entire invoice to a different currency
 */
export async function convertInvoiceCurrency(
  invoice: MultiCurrencyInvoice,
  newCurrency: string,
  options: InvoiceCalculationOptions = {}
): Promise<MultiCurrencyInvoice> {
  log.info(
    { from: invoice.invoiceCurrency, to: newCurrency },
    'Converting invoice currency'
  );

  const originalLineItems = invoice.lineItems.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    currency: item.currency,
    taxRate: item.taxRate,
    metadata: item.metadata,
  }));

  return createMultiCurrencyInvoice(originalLineItems, newCurrency, options);
}

/**
 * Validates that an invoice's totals are correct
 */
export function validateInvoiceTotals(invoice: MultiCurrencyInvoice): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Recalculate subtotal
  const calculatedSubtotal = invoice.lineItems.reduce(
    (sum, item) => sum + item.convertedSubtotal,
    0
  );

  const decimals = getCurrency(invoice.invoiceCurrency)?.decimalDigits ?? 2;
  const roundedCalculatedSubtotal = roundAmount(calculatedSubtotal, decimals);

  if (Math.abs(roundedCalculatedSubtotal - invoice.subtotal) > 0.01) {
    errors.push(
      `Subtotal mismatch: expected ${roundedCalculatedSubtotal}, got ${invoice.subtotal}`
    );
  }

  // Recalculate tax
  const calculatedTax = invoice.lineItems.reduce((sum, item) => {
    if (item.taxRate) {
      return sum + (item.convertedSubtotal * item.taxRate) / 100;
    }
    return sum;
  }, 0);

  const roundedCalculatedTax = roundAmount(calculatedTax, decimals);

  if (Math.abs(roundedCalculatedTax - invoice.taxAmount) > 0.01) {
    errors.push(
      `Tax amount mismatch: expected ${roundedCalculatedTax}, got ${invoice.taxAmount}`
    );
  }

  // Validate total
  const calculatedTotal = invoice.subtotal + invoice.taxAmount;
  if (Math.abs(calculatedTotal - invoice.totalAmount) > 0.01) {
    errors.push(
      `Total amount mismatch: expected ${calculatedTotal}, got ${invoice.totalAmount}`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Rounds an amount based on the specified mode
 */
function roundAmount(
  amount: number,
  decimals: number,
  mode: 'up' | 'down' | 'nearest' = 'nearest'
): number {
  const multiplier = Math.pow(10, decimals);

  switch (mode) {
    case 'up':
      return Math.ceil(amount * multiplier) / multiplier;
    case 'down':
      return Math.floor(amount * multiplier) / multiplier;
    case 'nearest':
    default:
      return Math.round(amount * multiplier) / multiplier;
  }
}

/**
 * Formats an invoice for display
 */
export function formatInvoiceForDisplay(invoice: MultiCurrencyInvoice): string {
  const currencyConfig = getCurrency(invoice.invoiceCurrency);
  const symbol = currencyConfig?.symbol ?? invoice.invoiceCurrency;

  let output = `Invoice (${invoice.invoiceCurrency})\n`;
  output += `${'='.repeat(50)}\n\n`;

  invoice.lineItems.forEach((item, index) => {
    output += `${index + 1}. ${item.description}\n`;
    output += `   Qty: ${item.quantity} × ${item.currency} ${item.unitPrice.toFixed(2)}`;
    
    if (item.currency !== invoice.invoiceCurrency) {
      output += ` (@ ${item.conversionRate.toFixed(4)})`;
    }
    
    output += `\n`;
    output += `   Subtotal: ${symbol}${item.convertedSubtotal.toFixed(currencyConfig?.decimalDigits ?? 2)}\n`;
    
    if (item.taxRate) {
      const itemTax = (item.convertedSubtotal * item.taxRate) / 100;
      output += `   Tax (${item.taxRate}%): ${symbol}${itemTax.toFixed(currencyConfig?.decimalDigits ?? 2)}\n`;
    }
    
    output += `\n`;
  });

  output += `${'-'.repeat(50)}\n`;
  output += `Subtotal: ${symbol}${invoice.subtotal.toFixed(currencyConfig?.decimalDigits ?? 2)}\n`;
  output += `Tax: ${symbol}${invoice.taxAmount.toFixed(currencyConfig?.decimalDigits ?? 2)}\n`;
  output += `${'='.repeat(50)}\n`;
  output += `Total: ${symbol}${invoice.totalAmount.toFixed(currencyConfig?.decimalDigits ?? 2)}\n`;

  return output;
}







