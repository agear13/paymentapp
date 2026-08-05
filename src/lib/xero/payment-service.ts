/**
 * Xero Payment Service
 * Records payments in Xero with multi-token support
 * Supports: STRIPE, HBAR, USDC, USDT, AUDD (4 separate crypto clearing accounts)
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { Payment } from 'xero-node';
import type { TokenType } from '@/lib/hedera/constants';
import { fetchXeroAccounts } from './accounts-service';
import {
  paymentMethodAndTokenToSettlementContext,
  resolveSettlementAccount,
} from '@/lib/accounting/settlement-account-resolver';
import { provisionSettlementAccount } from '@/lib/accounting/settlement-account-provisioning.server';

import type { XeroExportContext } from './xero-layer-export';
import {
  buildXeroLayerPaymentNarration,
  buildXeroLayerPaymentReference,
} from './xero-layer-export';

export interface PaymentRecordingParams {
  paymentLinkId: string;
  organizationId: string;
  invoiceId: string;
  amount: string;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET' | 'CRYPTO';
  paymentToken?: TokenType | string;
  transactionId: string;
  fxRate?: number;
  cryptoAmount?: string;
  /** When set, accounting layer drives posting amount; settlement is audit-only. */
  exportContext?: XeroExportContext;
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
    exportContext,
  } = params;

  const postingAmount = exportContext?.posting.amount ?? amount;
  const usesAccountingLayer = exportContext?.posting.usesAccountingLayer ?? false;

  // Get Xero connection
  const connection = await getActiveConnection(organizationId);
  if (!connection) {
    throw new Error('No active Xero connection');
  }

  // Get account mappings
  let settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
  });

  if (!settings) {
    throw new Error('Merchant settings not found');
  }

  const settlementContext = paymentMethodAndTokenToSettlementContext(
    paymentMethod,
    paymentToken,
    currency
  );

  let clearingAccountId = resolveSettlementAccountCode(settings, settlementContext);

  if (!clearingAccountId) {
    const provisioned = await provisionSettlementAccount({
      organizationId,
      paymentRail: settlementContext.paymentRail,
      collectionMethod: settlementContext.collectionMethod,
      paymentAsset: settlementContext.paymentAsset,
    });

    if (provisioned.status === 'linked') {
      clearingAccountId = provisioned.xeroAccountCode;
      if (provisioned.resolution.status === 'resolved' && provisioned.resolution.mappingField) {
        settings = {
          ...settings,
          [provisioned.resolution.mappingField]: provisioned.xeroAccountCode,
        };
      }
    } else {
      throw new Error(provisioned.customerMessage);
    }
  }

  if (!clearingAccountId) {
    throw new Error(
      `Holding account not set up for ${settlementContext.paymentRail}${
        settlementContext.paymentAsset ? ` (${settlementContext.paymentAsset})` : ''
      }. Open Xero setup and link the required holding account.`
    );
  }

  // Initialize Xero client
  const xeroClient = getXeroClient();
  const { applyConnectionToXeroClient } = await import('./apply-connection-token-set');
  await applyConnectionToXeroClient(xeroClient, connection, 'record_payment');

  // Update tenants (read-only property, must use updateTenants method)
  await xeroClient.updateTenants();

  const { accounts } = await fetchXeroAccounts(organizationId);
  const clearingCodeExists = accounts.some((account) => account.code === clearingAccountId);
  if (!clearingCodeExists) {
    throw new Error(
      `Mapped clearing account code "${clearingAccountId}" is not available in Xero. Refresh account mappings and select an active account code.`
    );
  }

  const narration = exportContext
    ? buildXeroLayerPaymentNarration({
        metadata: exportContext.metadata,
        posting: exportContext.posting,
        paymentMethod,
        paymentToken,
        transactionId,
        legacySettlementFxRate: fxRate,
        legacyCryptoAmount: cryptoAmount,
      })
    : buildPaymentNarration(
        paymentMethod,
        paymentToken,
        transactionId,
        fxRate,
        cryptoAmount,
        postingAmount,
        currency
      );

  const paymentReference = exportContext
    ? buildXeroLayerPaymentReference({
        paymentMethod,
        paymentToken,
        transactionId,
        metadata: exportContext.metadata,
      })
    : buildPaymentReference(paymentMethod, paymentToken, transactionId);

  /** Accounting-layer invoices post in org currency — no live settlement FX on payment. */
  const paymentCurrencyRate = usesAccountingLayer ? undefined : fxRate;

  // Create payment
  const payment: Payment = {
    invoice: { invoiceID: invoiceId },
    account: { code: clearingAccountId }, // Use 'code' not 'accountID' for account codes
    date: paymentDate.toISOString().split('T')[0],
    amount: parseFloat(postingAmount),
    reference: paymentReference,
    currencyRate: paymentCurrencyRate,
  };

  // Create payment in Xero
  let response;
  try {
    response = await xeroClient.accountingApi.createPayment(
      connection.tenantId,
      payment
    );
  } catch (error: unknown) {
    const details =
      typeof error === 'object' && error !== null
        ? (error as { response?: { body?: unknown }; message?: string }).response?.body ||
          (error as { message?: string }).message
        : undefined;
    throw new Error(`Failed to create payment in Xero: ${JSON.stringify(details)}`);
  }

  if (!response.body.payments || response.body.payments.length === 0) {
    throw new Error('Failed to create payment in Xero');
  }

  const createdPayment = response.body.payments[0];

  const paymentId = createdPayment.paymentID?.trim();
  if (!paymentId) {
    loggers.xero.error(
      'createPayment: missing paymentID in Xero response',
      undefined,
      {
        organizationId,
        invoiceId,
        xeroPayments: response.body.payments,
      }
    );
    throw new Error('Xero did not return a valid payment ID');
  }

  loggers.xero.info('Xero payment recorded', {
    organizationId,
    invoiceId,
    paymentId,
    clearingAccount: clearingAccountId,
    narration,
    amount: createdPayment.amount,
  });

  return {
    paymentId,
    status: String(createdPayment.status!),
    amount: createdPayment.amount!,
    narration,
  };
}

/**
 * Resolve holding account code from merchant settings via settlement resolver.
 */
function resolveSettlementAccountCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
  context: ReturnType<typeof paymentMethodAndTokenToSettlementContext>
): string | null {
  const resolution = resolveSettlementAccount({
    paymentRail: context.paymentRail,
    collectionMethod: context.collectionMethod,
    paymentAsset: context.paymentAsset,
    settings,
  });
  return resolution.status === 'resolved' ? resolution.xeroAccountCode : null;
}

/**
 * @deprecated Use resolveSettlementAccount from settlement-account-resolver.
 */
function getClearingAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
  paymentMethod: 'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET' | 'CRYPTO',
  paymentToken?: TokenType | string,
  currency?: string
): string | null {
  const context = paymentMethodAndTokenToSettlementContext(
    paymentMethod,
    paymentToken,
    currency
  );
  return resolveSettlementAccountCode(settings, context);
}

/**
 * Build payment reference for Xero
 */
function buildPaymentReference(
  paymentMethod: 'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET' | 'CRYPTO',
  paymentToken: TokenType | string | undefined,
  transactionId: string
): string {
  if (paymentMethod === 'STRIPE') {
    return `STRIPE: ${transactionId.substring(0, 20)}`;
  }
  if (paymentMethod === 'WISE') {
    return `WISE: ${transactionId.substring(0, 30)}`;
  }
  if (paymentMethod === 'EVM_WALLET') {
    return `EVM: ${transactionId.substring(0, 30)}`;
  }
  if (paymentMethod === 'CRYPTO') {
    return `${paymentToken ?? 'WALLET'}: ${transactionId.substring(0, 30)}`;
  }
  return `${paymentToken}: ${transactionId.substring(0, 30)}`;
}

/**
 * Build payment narration per specification
 */
function buildPaymentNarration(
  paymentMethod: 'STRIPE' | 'HEDERA' | 'WISE' | 'EVM_WALLET' | 'CRYPTO',
  paymentToken: TokenType | string | undefined,
  transactionId: string,
  fxRate: number | undefined,
  cryptoAmount: string | undefined,
  fiatAmount: string,
  fiatCurrency: string
): string {
  if (paymentMethod === 'STRIPE') {
    return `Payment via STRIPE\nTransaction: ${transactionId}\nAmount: ${fiatAmount} ${fiatCurrency}`;
  }
  if (paymentMethod === 'WISE') {
    return `Payment via WISE\nTransfer: ${transactionId}\nAmount: ${fiatAmount} ${fiatCurrency}`;
  }
  if (paymentMethod === 'CRYPTO') {
    const parts = [
      `Payment via MANUAL_WALLET_${paymentToken ?? 'CRYPTO'}`,
      `Transaction: ${transactionId}`,
      `Token: ${paymentToken ?? 'CRYPTO'}`,
    ];
    if (fxRate && cryptoAmount) {
      parts.push(
        `FX Rate: ${fxRate.toFixed(8)} ${paymentToken}/${fiatCurrency} @ ${new Date().toISOString()}`
      );
      parts.push(`Amount: ${cryptoAmount} ${paymentToken} = ${fiatAmount} ${fiatCurrency}`);
    } else {
      parts.push(`Amount: ${fiatAmount} ${fiatCurrency}`);
    }
    return parts.join('\n');
  }
  if (paymentMethod === 'EVM_WALLET') {
    const parts = [
      `Payment via EVM_WALLET_${paymentToken}`,
      `Transaction: ${transactionId}`,
      `Token: ${paymentToken}`,
    ];

    if (fxRate && cryptoAmount) {
      const rateFormatted = fxRate.toFixed(8);
      parts.push(
        `FX Rate: ${rateFormatted} ${paymentToken}/${fiatCurrency} @ ${new Date().toISOString()}`
      );
      parts.push(`Amount: ${cryptoAmount} ${paymentToken} = ${fiatAmount} ${fiatCurrency}`);
    }

    return parts.join('\n');
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






