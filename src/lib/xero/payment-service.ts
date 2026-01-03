/**
 * Xero Payment Service
 * Records payments in Xero with multi-token support
 * Supports: STRIPE, HBAR, USDC, USDT, AUDD (4 separate crypto clearing accounts)
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { prisma } from '@/lib/server/prisma';
import type { Payment } from 'xero-node';
import type { TokenType } from '@/lib/hedera/types';

export interface PaymentRecordingParams {
  paymentLinkId: string;
  organizationId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'STRIPE' | 'HEDERA';
  paymentToken?: TokenType; // HBAR | USDC | USDT | AUDD
  transactionId: string;
  fxRate?: number;
  cryptoAmount?: string;
}

export interface PaymentRecordingResult {
  paymentId: string;
  status: string;
  amount: number;
  narration: string;
}

/**
 * Record payment in Xero
 */
export async function recordXeroPayment(
  params: PaymentRecordingParams
): Promise<PaymentRecordingResult> {
  const {
    paymentLinkId,
    organizationId,
    invoiceId,
    amount,
    currency,
    paymentDate,
    paymentMethod,
    paymentToken,
    transactionId,
    fxRate,
    cryptoAmount,
  } = params;

  // Get Xero connection
  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection');
  }

  // Get account mappings
  const settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
  });

  if (!settings) {
    throw new Error('Merchant settings not found');
  }

  // Get the correct clearing account ID based on payment method/token
  const clearingAccountId = getClearingAccountId(settings, paymentMethod, paymentToken);

  if (!clearingAccountId) {
    throw new Error(
      `Clearing account not mapped for ${paymentMethod}${
        paymentToken ? ` - ${paymentToken}` : ''
      }. Please configure Xero account mappings.`
    );
  }

  // Initialize Xero client
  const xeroClient = getXeroClient();
  await xeroClient.setTokenSet({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expires_at: connection.expiresAt.getTime(),
  });

  // Set active tenant
  xeroClient.tenants = [{
    tenantId: connection.tenantId,
    tenantType: 'ORGANISATION',
    tenantName: '',
    createdDateUtc: new Date(),
    updatedDateUtc: new Date(),
  }];

  // Build payment narration
  const narration = buildPaymentNarration(
    paymentMethod,
    paymentToken,
    transactionId,
    fxRate,
    cryptoAmount,
    amount,
    currency
  );

  // Create payment
  const payment: Payment = {
    invoice: { invoiceID: invoiceId },
    account: { accountID: clearingAccountId },
    date: paymentDate.toISOString().split('T')[0],
    amount: parseFloat(amount),
    reference: buildPaymentReference(paymentMethod, paymentToken, transactionId),
    currencyRate: fxRate,
  };

  // Create payment in Xero
  const response = await xeroClient.accountingApi.createPayment(
    connection.tenantId,
    payment
  );

  if (!response.body.payments || response.body.payments.length === 0) {
    throw new Error('Failed to create payment in Xero');
  }

  const createdPayment = response.body.payments[0];

  // Log the narration for audit trail
  console.log('Payment recorded in Xero:', {
    paymentId: createdPayment.paymentID,
    clearingAccount: clearingAccountId,
    narration,
  });

  return {
    paymentId: createdPayment.paymentID!,
    status: createdPayment.status!,
    amount: createdPayment.amount!,
    narration,
  };
}

/**
 * Get clearing account ID based on payment method and token
 * ⭐ CRITICAL: Each crypto token must map to its own Xero clearing account
 */
function getClearingAccountId(
  settings: any,
  paymentMethod: 'STRIPE' | 'HEDERA',
  paymentToken?: TokenType
): string | null {
  if (paymentMethod === 'STRIPE') {
    return settings.xero_stripe_clearing_account_id;
  }

  // Hedera - map based on token type
  // CRITICAL: Each token must have its own clearing account for proper reconciliation
  switch (paymentToken) {
    case 'HBAR':
      return settings.xero_hbar_clearing_account_id; // Typically account 1051
    case 'USDC':
      return settings.xero_usdc_clearing_account_id; // Typically account 1052
    case 'USDT':
      return settings.xero_usdt_clearing_account_id; // Typically account 1053
    case 'AUDD':
      return settings.xero_audd_clearing_account_id; // Typically account 1054 ⭐
    default:
      return null;
  }
}

/**
 * Build payment reference for Xero
 */
function buildPaymentReference(
  paymentMethod: 'STRIPE' | 'HEDERA',
  paymentToken: TokenType | undefined,
  transactionId: string
): string {
  if (paymentMethod === 'STRIPE') {
    return `STRIPE: ${transactionId.substring(0, 20)}`;
  }

  return `${paymentToken}: ${transactionId.substring(0, 30)}`;
}

/**
 * Build payment narration per specification
 * Includes: Method, Transaction ID, Token, FX Rate, Amounts
 */
function buildPaymentNarration(
  paymentMethod: 'STRIPE' | 'HEDERA',
  paymentToken: TokenType | undefined,
  transactionId: string,
  fxRate: number | undefined,
  cryptoAmount: string | undefined,
  fiatAmount: string,
  fiatCurrency: string
): string {
  if (paymentMethod === 'STRIPE') {
    return `Payment via STRIPE
Transaction: ${transactionId}
Amount: ${fiatAmount} ${fiatCurrency}`;
  }

  // Hedera payment
  const parts = [
    `Payment via HEDERA_${paymentToken}`,
    `Transaction: ${transactionId}`,
    `Token: ${paymentToken}`,
  ];

  if (fxRate && cryptoAmount) {
    // Format FX rate with appropriate precision
    const rateFormatted = fxRate.toFixed(8);
    parts.push(
      `FX Rate: ${rateFormatted} ${paymentToken}/${fiatCurrency} @ ${new Date().toISOString()}`
    );
    parts.push(`Amount: ${cryptoAmount} ${paymentToken} = ${fiatAmount} ${fiatCurrency}`);
  }

  // Add special note for AUDD when currency-matched
  if (paymentToken === 'AUDD' && fiatCurrency === 'AUD') {
    parts.push('✓ No FX risk - Currency matched payment 🇦🇺');
  }

  return parts.join('\n');
}






