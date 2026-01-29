/**
 * Repair Stuck Stripe Payment
 * 
 * This script repairs Stripe payments that are marked PAID in Stripe
 * but stuck in OPEN status in our database.
 * 
 * Usage:
 *   npx tsx scripts/repair-stripe-payment.ts <checkoutSessionId>
 *   npx tsx scripts/repair-stripe-payment.ts cs_live_a1afaPO...
 * 
 * What it does:
 * 1. Fetches session from Stripe API
 * 2. Verifies it's marked as paid
 * 3. Calls confirmPayment() service (idempotent)
 * 4. Creates PAYMENT_CONFIRMED event + ledger entries
 * 5. Updates payment_links.status to PAID
 */

import { stripe } from '@/lib/stripe/client';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import { generateCorrelationId } from '@/lib/services/correlation';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';

const checkoutSessionId = process.argv[2];

if (!checkoutSessionId) {
  console.error('❌ Error: Missing checkout session ID');
  console.error('');
  console.error('Usage:');
  console.error('  npx tsx scripts/repair-stripe-payment.ts <checkoutSessionId>');
  console.error('');
  console.error('Example:');
  console.error('  npx tsx scripts/repair-stripe-payment.ts cs_live_a1afaPO...');
  process.exit(1);
}

async function repairStuckPayment() {
  try {
    console.log('🔍 Fetching Stripe session:', checkoutSessionId);
    console.log('');
    
    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    
    console.log('Session Details:');
    console.log('  Status:', session.status);
    console.log('  Payment Status:', session.payment_status);
    console.log('  Amount:', session.amount_total ? session.amount_total / 100 : 0, session.currency?.toUpperCase());
    console.log('  Customer Email:', session.customer_email || 'N/A');
    console.log('');
    
    // Validate session is paid
    if (session.payment_status !== 'paid') {
      console.error(`❌ Error: Session not paid in Stripe`);
      console.error(`   Current status: ${session.payment_status}`);
      console.error('   Cannot repair unpaid session');
      process.exit(1);
    }
    
    // Extract payment_link_id from metadata
    const paymentLinkId = session.metadata?.payment_link_id;
    
    if (!paymentLinkId) {
      console.error('❌ Error: No payment_link_id in session metadata');
      console.error('   Session metadata:', session.metadata);
      process.exit(1);
    }
    
    console.log('✅ Found payment_link_id:', paymentLinkId);
    console.log('');
    
    // Check current status in our DB
    const paymentLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: {
        status: true,
        amount: true,
        currency: true,
        short_code: true,
      },
    });
    
    if (!paymentLink) {
      console.error('❌ Error: Payment link not found in database');
      process.exit(1);
    }
    
    console.log('Current Database Status:');
    console.log('  Payment Link Status:', paymentLink.status);
    console.log('  Short Code:', paymentLink.short_code);
    console.log('  Amount:', paymentLink.amount.toString(), paymentLink.currency);
    console.log('');
    
    if (paymentLink.status === 'PAID') {
      console.log('⚠️  Payment link already marked as PAID');
      console.log('   Continuing anyway (idempotent)...');
      console.log('');
    }
    
    // Generate correlation ID for tracing
    const correlationId = generateCorrelationId('stripe', `repair_${checkoutSessionId}`);
    
    console.log('🔧 Running payment confirmation...');
    console.log('   Correlation ID:', correlationId);
    console.log('');
    
    // Call confirmPayment service (idempotent - safe to retry)
    const result = await confirmPayment({
      paymentLinkId,
      provider: 'stripe',
      providerRef: `repair_${checkoutSessionId}`, // Unique event ref for this repair
      paymentIntentId: session.payment_intent as string,
      checkoutSessionId: session.id,
      amountReceived: session.amount_total ? session.amount_total / 100 : 0,
      currencyReceived: session.currency?.toUpperCase() || 'USD',
      correlationId,
      metadata: {
        repaired: true,
        repairedAt: new Date().toISOString(),
        repairedBy: 'repair-stripe-payment script',
        checkoutSessionId: session.id,
        paymentStatus: session.payment_status,
      },
    });
    
    if (!result.success) {
      console.error('❌ Repair failed:', result.error);
      process.exit(1);
    }
    
    console.log('✅ SUCCESS! Payment repaired');
    console.log('');
    console.log('Results:');
    console.log('  Payment Event ID:', result.paymentEventId);
    console.log('  Already Processed:', result.alreadyProcessed || false);
    console.log('');
    
    // Verify in database
    const updatedLink = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: { status: true },
    });
    
    const eventCount = await prisma.payment_events.count({
      where: { payment_link_id: paymentLinkId },
    });
    
    const ledgerCount = await prisma.ledger_entries.count({
      where: { payment_link_id: paymentLinkId },
    });
    
    console.log('Verification:');
    console.log('  Payment Link Status:', updatedLink?.status);
    console.log('  Payment Events:', eventCount);
    console.log('  Ledger Entries:', ledgerCount);
    console.log('');
    
    if (updatedLink?.status === 'PAID' && ledgerCount >= 2) {
      console.log('🎉 All checks passed! Payment is fully repaired.');
    } else {
      console.warn('⚠️  Warning: Some checks failed. Review manually.');
    }
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    console.error('');
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the repair
console.log('='.repeat(60));
console.log('Stripe Payment Repair Tool');
console.log('='.repeat(60));
console.log('');

repairStuckPayment()
  .then(() => {
    console.log('');
    console.log('='.repeat(60));
    console.log('Script completed successfully');
    console.log('='.repeat(60));
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('='.repeat(60));
    console.error('Script failed');
    console.error('='.repeat(60));
    process.exit(1);
  });
