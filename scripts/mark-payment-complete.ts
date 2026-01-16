/**
 * Quick script to manually mark a payment as complete
 * Usage: npx tsx scripts/mark-payment-complete.ts <paymentLinkId> <transactionId>
 */

import { prisma } from '../src/lib/server/prisma';
import { loggers } from '../src/lib/logger';

async function markPaymentComplete(
  paymentLinkId: string,
  transactionId: string,
  tokenType: 'HBAR' | 'USDC' | 'USDT' | 'AUDD' = 'HBAR',
  amountReceived: string = '0'
) {
  try {
    console.log('🔍 Fetching payment link...');
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: {
        id: true,
        organization_id: true,
        status: true,
        amount: true,
        currency: true,
        description_for_customer: true,
      },
    });

    if (!paymentLink) {
      console.error('❌ Payment link not found:', paymentLinkId);
      process.exit(1);
    }

    if (paymentLink.status === 'PAID') {
      console.log('✅ Payment link already marked as PAID');
      process.exit(0);
    }

    console.log('📋 Payment Link:', {
      id: paymentLink.id,
      status: paymentLink.status,
      amount: paymentLink.amount,
      currency: paymentLink.currency,
      description: paymentLink.description_for_customer,
    });

    // Get or create ledger accounts
    console.log('🏦 Setting up ledger accounts...');
    const cryptoCode = `1051-${tokenType}`;
    const cryptoAccount = await prisma.ledger_accounts.upsert({
      where: {
        organization_id_code: {
          organization_id: paymentLink.organization_id,
          code: cryptoCode,
        },
      },
      update: {},
      create: {
        organization_id: paymentLink.organization_id,
        code: cryptoCode,
        name: `Crypto Clearing - ${tokenType}`,
        account_type: 'ASSET',
      },
    });

    const arCode = '1200';
    const arAccount = await prisma.ledger_accounts.upsert({
      where: {
        organization_id_code: {
          organization_id: paymentLink.organization_id,
          code: arCode,
        },
      },
      update: {},
      create: {
        organization_id: paymentLink.organization_id,
        code: arCode,
        name: 'Accounts Receivable',
        account_type: 'ASSET',
      },
    });

    const now = new Date();
    const idempotencyKey = `hedera-${paymentLinkId}-${transactionId}`;

    console.log('💾 Creating transaction records...');

    // Update payment link and create records in a transaction
    await prisma.$transaction([
      // 1. Update payment link status
      prisma.payment_links.update({
        where: { id: paymentLinkId },
        data: {
          status: 'PAID',
          updated_at: now,
        },
      }),

      // 2. Create payment event
      prisma.payment_events.create({
        data: {
          payment_link_id: paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
          payment_method: 'HEDERA',
          hedera_transaction_id: transactionId,
          amount_received: amountReceived || paymentLink.amount.toString(),
          currency_received: tokenType,
          metadata: {
            transactionId,
            amount: amountReceived || paymentLink.amount.toString(),
            tokenType,
            manuallyMarked: true,
            markedAt: now.toISOString(),
          },
        },
      }),

      // 3. Create ledger entry: DEBIT Crypto Clearing
      prisma.ledger_entries.create({
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: cryptoAccount.id,
          entry_type: 'DEBIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${transactionId} (manually marked)`,
          idempotency_key: `${idempotencyKey}-debit`,
          created_at: now,
        },
      }),

      // 4. Create ledger entry: CREDIT Accounts Receivable
      prisma.ledger_entries.create({
        data: {
          payment_link_id: paymentLinkId,
          ledger_account_id: arAccount.id,
          entry_type: 'CREDIT',
          amount: paymentLink.amount,
          currency: paymentLink.currency,
          description: `${tokenType} payment received - ${transactionId} (manually marked)`,
          idempotency_key: `${idempotencyKey}-credit`,
          created_at: now,
        },
      }),
    ]);

    console.log('✅ Payment marked as complete!');
    console.log('Transaction ID:', transactionId);
    console.log('Token Type:', tokenType);
    console.log('Payment Link Status: PAID');
  } catch (error) {
    console.error('❌ Error marking payment as complete:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: npx tsx scripts/mark-payment-complete.ts <paymentLinkId> <transactionId> [tokenType] [amount]');
  console.error('Example: npx tsx scripts/mark-payment-complete.ts 765fca01-0923-4ba8-a7c5-d4acfa1243fb 0.0.5363033@1768534284.182368814 HBAR 100.50');
  process.exit(1);
}

const [paymentLinkId, transactionId, tokenType = 'HBAR', amount = '0'] = args;

markPaymentComplete(
  paymentLinkId,
  transactionId,
  tokenType as 'HBAR' | 'USDC' | 'USDT' | 'AUDD',
  amount
);

