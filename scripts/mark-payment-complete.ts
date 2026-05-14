/**
 * Manual Hedera settlement helper for operations.
 * All production settlement must converge through confirmPayment() — this script
 * delegates to it for PAYMENT_CONFIRMED, state transition, ledger, and replay safety.
 *
 * Usage: npx tsx scripts/mark-payment-complete.ts <paymentLinkId> <transactionId> [tokenType] [amount]
 */

import { prisma } from '../src/lib/server/prisma';
import { confirmPayment } from '../src/lib/services/payment-confirmation';
import { normalizeHederaTransactionId } from '../src/lib/hedera/txid';
import { generateCorrelationId } from '../src/lib/services/correlation';

async function markPaymentComplete(
  paymentLinkId: string,
  transactionId: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT' | 'AUDD' = 'HBAR',
  amountArg: string = '0'
) {
  try {
    console.log('🔍 Fetching payment link...');
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        invoice_currency: true,
        description_for_customer: true,
      },
    });

    if (!paymentLink) {
      console.error('❌ Payment link not found:', paymentLinkId);
      process.exit(1);
    }

    console.log('📋 Payment Link:', {
      id: paymentLink.id,
      status: paymentLink.status,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description_for_customer,
    });

    const normalizedTxId = normalizeHederaTransactionId(transactionId);
    const parsed = parseFloat(amountArg);
    const amountReceived =
      Number.isFinite(parsed) && parsed > 0 ? parsed : Number(paymentLink.amount.toString());

    const correlationId = generateCorrelationId('hedera', `manual_mark_${paymentLinkId}_${normalizedTxId}`);

    console.log('📤 Running canonical confirmPayment (hedera)...');
    const result = await confirmPayment({
      paymentLinkId,
      provider: 'hedera',
      providerRef: transactionId,
      transactionId: normalizedTxId,
      amountReceived,
      currencyReceived: tokenType,
      tokenType,
      correlationId,
      metadata: {
        manuallyMarked: true,
        markedAt: new Date().toISOString(),
        source: 'script:mark-payment-complete',
        raw_transaction_id: transactionId,
        normalized_transaction_id: normalizedTxId,
      },
    });

    if (!result.success) {
      console.error('❌ confirmPayment failed:', result.error);
      process.exit(1);
    }

    console.log('✅ Settlement complete via confirmPayment');
    console.log('   paymentEventId:', result.paymentEventId);
    console.log('   alreadyProcessed:', result.alreadyProcessed);
    console.log('   Transaction ID:', transactionId);
    console.log('   Token Type:', tokenType);
  } catch (error) {
    console.error('❌ Error marking payment as complete:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    'Usage: npx tsx scripts/mark-payment-complete.ts <paymentLinkId> <transactionId> [tokenType] [amount]'
  );
  console.error(
    'Example: npx tsx scripts/mark-payment-complete.ts 765fca01-0923-4ba8-a7c5-d4acfa1243fb 0.0.5363033@1768534284.182368814 HBAR 100.50'
  );
  process.exit(1);
}

const [paymentLinkId, transactionId, tokenType = 'HBAR', amount = '0'] = args;

markPaymentComplete(
  paymentLinkId,
  transactionId,
  tokenType as 'HBAR' | 'USDC' | 'USDT' | 'AUDD',
  amount
);
