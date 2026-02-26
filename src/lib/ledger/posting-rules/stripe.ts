/**
 * Stripe Settlement Posting Rules
 * Double-entry accounting rules for Stripe credit card payments
 * 
 * Posting Logic:
 * 1. DR Stripe Clearing (1050), CR Accounts Receivable (1200) - Gross amount
 * 2. DR Processor Fee Expense (6100), CR Stripe Clearing (1050) - Fee amount
 */

import { LedgerEntryService, JournalEntry } from '../ledger-entry-service';
import { LEDGER_ACCOUNTS } from '../account-mapping';
import { provisionStripeLedgerAccounts } from '../ledger-account-provisioner';
import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';

/**
 * Parameters for Stripe settlement posting
 */
export interface StripeSettlementParams {
  paymentLinkId: string;
  organizationId: string;
  stripePaymentIntentId: string;
  grossAmount: string; // Total amount received (decimal string)
  feeAmount: string; // Stripe processing fee (decimal string)
  currency: string; // ISO 4217 currency code
  netAmount?: string; // Optional: net amount after fees
  correlationId?: string; // Optional: for idempotent retry logging
}

/**
 * Post Stripe settlement to ledger
 * Creates two sets of journal entries:
 * 1. Record gross payment received
 * 2. Record processing fees
 * 
 * @param params - Settlement parameters
 * @returns Promise<void>
 * @throws Error if posting fails
 */
export async function postStripeSettlement(
  params: StripeSettlementParams
): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    stripePaymentIntentId,
    grossAmount,
    feeAmount,
    currency,
    correlationId,
  } = params;

  loggers.ledger.info(
    {
      paymentLinkId,
      stripePaymentIntentId,
      grossAmount,
      feeAmount,
      currency,
    },
    'Starting Stripe settlement posting'
  );

  // Provision required ledger accounts (1050, 1200, 6100) before posting
  await provisionStripeLedgerAccounts(prisma, organizationId, correlationId);

  const ledgerService = new LedgerEntryService();

  // Entry 1: Record gross payment
  // DR Stripe Clearing, CR Accounts Receivable
  const paymentDescription = buildPaymentDescription({
    stripePaymentIntentId,
    grossAmount,
    feeAmount,
    currency,
  });

  const paymentEntries: JournalEntry[] = [
    {
      accountCode: LEDGER_ACCOUNTS.STRIPE_CLEARING, // 1050
      entryType: 'DEBIT',
      amount: grossAmount,
      currency,
      description: paymentDescription,
    },
    {
      accountCode: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE, // 1200
      entryType: 'CREDIT',
      amount: grossAmount,
      currency,
      description: paymentDescription,
    },
  ];

  await ledgerService.postJournalEntries({
    entries: paymentEntries,
    paymentLinkId,
    organizationId,
    idempotencyKey: `stripe-payment-${stripePaymentIntentId}`,
    correlationId,
  });

  loggers.ledger.info(
    {
      paymentLinkId,
      stripePaymentIntentId,
      grossAmount,
    },
    'Posted Stripe payment entries'
  );

  // Entry 2: Record fees (if any)
  if (parseFloat(feeAmount) > 0) {
    const feeDescription = buildFeeDescription({
      stripePaymentIntentId,
      feeAmount,
      grossAmount,
      currency,
    });

    const feeEntries: JournalEntry[] = [
      {
        accountCode: LEDGER_ACCOUNTS.PROCESSOR_FEE_EXPENSE, // 6100
        entryType: 'DEBIT',
        amount: feeAmount,
        currency,
        description: feeDescription,
      },
      {
        accountCode: LEDGER_ACCOUNTS.STRIPE_CLEARING, // 1050
        entryType: 'CREDIT',
        amount: feeAmount,
        currency,
        description: feeDescription,
      },
    ];

    await ledgerService.postJournalEntries({
      entries: feeEntries,
      paymentLinkId,
      organizationId,
      idempotencyKey: `stripe-fee-${stripePaymentIntentId}`,
      correlationId,
    });

    loggers.ledger.info(
      {
        paymentLinkId,
        stripePaymentIntentId,
        feeAmount,
      },
      'Posted Stripe fee entries'
    );
  }

  loggers.ledger.info(
    {
      paymentLinkId,
      stripePaymentIntentId,
    },
    'Stripe settlement posting complete'
  );
}

/**
 * Build description for payment entries
 */
function buildPaymentDescription(params: {
  stripePaymentIntentId: string;
  grossAmount: string;
  feeAmount: string;
  currency: string;
}): string {
  const { stripePaymentIntentId, grossAmount, feeAmount, currency } = params;

  const netAmount = (
    parseFloat(grossAmount) - parseFloat(feeAmount)
  ).toFixed(2);

  return [
    'Stripe credit card payment received',
    `Payment Intent: ${stripePaymentIntentId}`,
    `Gross amount: ${grossAmount} ${currency}`,
    `Processing fee: ${feeAmount} ${currency}`,
    `Net amount: ${netAmount} ${currency}`,
  ].join('\n');
}

/**
 * Build description for fee entries
 */
function buildFeeDescription(params: {
  stripePaymentIntentId: string;
  feeAmount: string;
  grossAmount: string;
  currency: string;
}): string {
  const { stripePaymentIntentId, feeAmount, grossAmount, currency } = params;

  const feePercentage = (
    (parseFloat(feeAmount) / parseFloat(grossAmount)) *
    100
  ).toFixed(2);

  return [
    'Stripe processing fee',
    `Payment Intent: ${stripePaymentIntentId}`,
    `Fee: ${feeAmount} ${currency} (${feePercentage}% of ${grossAmount} ${currency})`,
  ].join('\n');
}

/**
 * Calculate Stripe fee from payment intent amount
 * Uses Stripe's standard pricing: 2.9% + $0.30
 * 
 * @param amount - Payment amount in smallest currency unit (cents)
 * @param currency - Currency code
 * @returns Fee amount as decimal string
 */
export function calculateStripeFee(amount: number, currency: string): string {
  // Stripe standard pricing: 2.9% + $0.30 (or equivalent in other currencies)
  const percentageFee = amount * 0.029;
  const fixedFee = currency === 'USD' ? 30 : 30; // 30 cents

  const totalFeeCents = Math.round(percentageFee + fixedFee);
  const totalFeeDollars = totalFeeCents / 100;

  return totalFeeDollars.toFixed(2);
}

/**
 * Extract fee from Stripe PaymentIntent
 * Stripe includes fee information in the charges
 * 
 * @param paymentIntent - Stripe PaymentIntent object
 * @returns Fee amount as decimal string
 */
export function extractStripeFee(paymentIntent: any): string {
  // If charges are expanded, get actual fee
  if (paymentIntent.charges?.data?.[0]?.balance_transaction) {
    const balanceTransaction = paymentIntent.charges.data[0].balance_transaction;
    if (typeof balanceTransaction === 'object' && balanceTransaction.fee) {
      return (balanceTransaction.fee / 100).toFixed(2);
    }
  }

  // Otherwise calculate estimated fee
  return calculateStripeFee(paymentIntent.amount, paymentIntent.currency);
}

/**
 * Parameters for Stripe refund reversal posting
 */
export interface StripeRefundReversalParams {
  paymentLinkId: string;
  organizationId: string;
  stripePaymentIntentId: string;
  refundAmountDollars: string;
  currency: string;
  stripeEventId: string;
  correlationId?: string;
}

/**
 * Post Stripe refund reversal to ledger (gross only; no fee reversal for launch).
 * Reverses the settlement: DR Accounts Receivable (1200), CR Stripe Clearing (1050).
 * Idempotency: stripe-refund-${stripeEventId} so duplicate webhook delivery does not double-post.
 */
export async function postStripeRefundReversal(
  params: StripeRefundReversalParams
): Promise<void> {
  const {
    paymentLinkId,
    organizationId,
    stripePaymentIntentId,
    refundAmountDollars,
    currency,
    stripeEventId,
    correlationId,
  } = params;

  loggers.ledger.info(
    {
      paymentLinkId,
      stripePaymentIntentId,
      refundAmountDollars,
      currency,
      stripeEventId,
    },
    'Starting Stripe refund reversal posting'
  );

  await provisionStripeLedgerAccounts(prisma, organizationId, correlationId);

  const ledgerService = new LedgerEntryService();
  const idempotencyKey = `stripe-refund-${stripeEventId}`;
  const description = [
    'Stripe refund reversal',
    `Payment Intent: ${stripePaymentIntentId}`,
    `Refund amount: ${refundAmountDollars} ${currency}`,
    `Event: ${stripeEventId}`,
  ].join('\n');

  const entries: JournalEntry[] = [
    {
      accountCode: LEDGER_ACCOUNTS.ACCOUNTS_RECEIVABLE,
      entryType: 'DEBIT',
      amount: refundAmountDollars,
      currency,
      description,
    },
    {
      accountCode: LEDGER_ACCOUNTS.STRIPE_CLEARING,
      entryType: 'CREDIT',
      amount: refundAmountDollars,
      currency,
      description,
    },
  ];

  await ledgerService.postJournalEntries({
    entries,
    paymentLinkId,
    organizationId,
    idempotencyKey,
    correlationId,
  });

  loggers.ledger.info(
    { paymentLinkId, stripeEventId, refundAmountDollars },
    'Stripe refund reversal posted'
  );
}






