/**
 * Xero Sync Test Factory
 */

import type { XeroSync } from '@prisma/client'

export function createMockXeroSync(
  overrides?: Partial<XeroSync>
): XeroSync {
  return {
    id: overrides?.id || `xero-sync-${Date.now()}`,
    organizationId: overrides?.organizationId || 'test-org-123',
    paymentLinkId: overrides?.paymentLinkId || 'test-link-123',
    status: overrides?.status || 'PENDING',
    syncType: overrides?.syncType || 'INVOICE_AND_PAYMENT',
    xeroInvoiceId: overrides?.xeroInvoiceId || null,
    xeroPaymentId: overrides?.xeroPaymentId || null,
    requestPayload: overrides?.requestPayload || null,
    responsePayload: overrides?.responsePayload || null,
    errorMessage: overrides?.errorMessage || null,
    errorCode: overrides?.errorCode || null,
    retryCount: overrides?.retryCount || 0,
    nextRetryAt: overrides?.nextRetryAt || null,
    completedAt: overrides?.completedAt || null,
    createdAt: overrides?.createdAt || new Date(),
    updatedAt: overrides?.updatedAt || new Date(),
  } as XeroSync
}

export function createMockAuddXeroSync(
  overrides?: Partial<XeroSync>
): XeroSync {
  const transactionId = `0.0.123@${Date.now()}.000000000`
  
  return createMockXeroSync({
    requestPayload: {
      paymentMethod: 'HEDERA',
      paymentToken: 'AUDD',
      transactionId,
      amount: '100.00',
      currency: 'AUD',
      cryptoAmount: '100.000000',
      fxRate: '1.00000000',
    },
    ...overrides,
  })
}

export function createMockSuccessfulXeroSync(
  overrides?: Partial<XeroSync>
): XeroSync {
  return createMockXeroSync({
    status: 'SUCCESS',
    xeroInvoiceId: 'xero-invoice-123',
    xeroPaymentId: 'xero-payment-456',
    completedAt: new Date(),
    ...overrides,
  })
}

export function createMockFailedXeroSync(
  overrides?: Partial<XeroSync>
): XeroSync {
  return createMockXeroSync({
    status: 'FAILED',
    errorMessage: 'Xero API error: Invalid account code',
    errorCode: 'INVALID_ACCOUNT',
    retryCount: 3,
    ...overrides,
  })
}

// Mock Xero API responses
export function createMockXeroInvoiceResponse(invoiceId: string = 'xero-invoice-123') {
  return {
    Invoices: [
      {
        InvoiceID: invoiceId,
        InvoiceNumber: `INV-${Date.now()}`,
        Type: 'ACCREC',
        Status: 'AUTHORISED',
        Contact: {
          ContactID: 'contact-123',
          Name: 'Test Customer',
        },
        DateString: new Date().toISOString().split('T')[0],
        DueDateString: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        LineAmountTypes: 'Exclusive',
        LineItems: [
          {
            Description: 'Payment Link - INV-123',
            Quantity: 1,
            UnitAmount: 100.00,
            AccountCode: '4000',
            TaxType: 'NONE',
            LineAmount: 100.00,
          },
        ],
        Total: 100.00,
        TotalTax: 0.00,
        AmountDue: 100.00,
        AmountPaid: 0.00,
        CurrencyCode: 'AUD',
      },
    ],
  }
}

export function createMockXeroPaymentResponse(
  paymentId: string = 'xero-payment-456',
  invoiceId: string = 'xero-invoice-123'
) {
  return {
    Payments: [
      {
        PaymentID: paymentId,
        Invoice: {
          InvoiceID: invoiceId,
          InvoiceNumber: `INV-${Date.now()}`,
        },
        Account: {
          AccountID: 'account-1054',
          Code: '1054',
          Name: 'Crypto Clearing - AUDD',
        },
        Date: new Date().toISOString().split('T')[0],
        Amount: 100.00,
        Reference: '0.0.123@1234567890.000000000',
        CurrencyRate: 1.0,
        PaymentType: 'ACCRECPAYMENT',
        Status: 'AUTHORISED',
      },
    ],
  }
}

export function createMockAuddPaymentNarration(
  transactionId: string,
  cryptoAmount: string = '100.000000',
  fiatAmount: string = '100.00',
  fiatCurrency: string = 'AUD',
  fxRate: string = '1.00000000'
): string {
  const parts = [
    `Payment via HEDERA_AUDD`,
    `Transaction: ${transactionId}`,
    `Token: AUDD`,
    `FX Rate: ${fxRate} AUDD/${fiatCurrency} @ ${new Date().toISOString()}`,
    `Amount: ${cryptoAmount} AUDD = ${fiatAmount} ${fiatCurrency}`,
  ]
  
  // Special note for AUD currency match
  if (fiatCurrency === 'AUD') {
    parts.push('✓ No FX risk - Currency matched payment 🇦🇺')
  }
  
  return parts.join('\n')
}







