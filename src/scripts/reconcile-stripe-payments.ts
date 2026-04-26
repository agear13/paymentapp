/**
 * Stripe reconciliation cron script for Payment Links.
 *
 * Usage:
 *   npx tsx src/scripts/reconcile-stripe-payments.ts
 *   npx tsx src/scripts/reconcile-stripe-payments.ts --dry-run
 */

import { stripe } from '@/lib/stripe/client';
import { prisma } from '@/lib/server/prisma';
import { confirmPayment } from '@/lib/services/payment-confirmation';

type ReconAction =
  | 'SKIPPED_ALREADY_PAID'
  | 'SKIPPED_ALREADY_CONFIRMED'
  | 'CONFIRMED_SUCCESS'
  | 'ERROR';

const dryRun = process.argv.includes('--dry-run');

function logRecord(paymentLinkId: string, action: ReconAction, reason: string) {
  console.log(
    `[RECON] payment_link_id=${paymentLinkId} action=${action} reason=${reason}`
  );
}

function extractCheckoutSessionId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const md = metadata as Record<string, unknown>;
  const candidates = [
    md.checkoutSessionId,
    md.checkout_session_id,
    md.checkout_sessionId,
    md.sessionId,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function run() {
  console.log(`[RECON] Stripe payment reconciliation started${dryRun ? ' (dry-run)' : ''}`);
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);

  const staleInitiated = await prisma.payment_events.findMany({
    where: {
      event_type: 'PAYMENT_INITIATED',
      payment_method: 'STRIPE',
      created_at: { lte: cutoff },
      payment_link_id: { not: null },
      payment_links: {
        status: 'OPEN',
      },
    },
    select: {
      payment_link_id: true,
      created_at: true,
      metadata: true,
    },
    orderBy: { created_at: 'desc' },
  });

  // Keep one stale PAYMENT_INITIATED event per payment link.
  const byPaymentLink = new Map<string, (typeof staleInitiated)[number]>();
  for (const event of staleInitiated) {
    if (!event.payment_link_id) continue;
    if (!byPaymentLink.has(event.payment_link_id)) {
      byPaymentLink.set(event.payment_link_id, event);
    }
  }

  console.log(`[RECON] Found ${byPaymentLink.size} stale Stripe payment link(s)`);

  for (const [paymentLinkId, initiatedEvent] of byPaymentLink.entries()) {
    try {
      console.log(`[RECON] Checking payment_link: ${paymentLinkId}`);

      const paymentLink = await prisma.payment_links.findUnique({
        where: { id: paymentLinkId },
        select: { id: true, status: true },
      });

      if (!paymentLink) {
        logRecord(paymentLinkId, 'ERROR', 'payment_link_not_found');
        continue;
      }

      if (paymentLink.status === 'PAID') {
        logRecord(paymentLinkId, 'SKIPPED_ALREADY_PAID', 'status_already_paid');
        continue;
      }

      const existingConfirmed = await prisma.payment_events.findFirst({
        where: {
          payment_link_id: paymentLinkId,
          event_type: 'PAYMENT_CONFIRMED',
        },
        select: { id: true },
      });

      if (existingConfirmed) {
        logRecord(
          paymentLinkId,
          'SKIPPED_ALREADY_CONFIRMED',
          `existing_payment_confirmed_event:${existingConfirmed.id}`
        );
        continue;
      }

      const checkoutSessionId = extractCheckoutSessionId(initiatedEvent.metadata);
      if (!checkoutSessionId) {
        logRecord(paymentLinkId, 'ERROR', 'missing_checkout_session_id');
        continue;
      }

      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      console.log(
        `[RECON] Status: ${paymentLink.status} -> Stripe says ${String(
          session.payment_status
        ).toUpperCase()}`
      );

      if (session.payment_status !== 'paid') {
        logRecord(
          paymentLinkId,
          'ERROR',
          `stripe_session_not_paid:${session.payment_status}`
        );
        continue;
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!paymentIntentId) {
        logRecord(paymentLinkId, 'ERROR', 'missing_payment_intent_id');
        continue;
      }

      const amountReceived = (session.amount_total ?? 0) / 100;
      const currencyReceived = (session.currency || 'usd').toUpperCase();
      const syntheticStripeEventId = `recon_${session.id}`;

      if (dryRun) {
        logRecord(
          paymentLinkId,
          'CONFIRMED_SUCCESS',
          `dry_run_would_confirm stripe_event_id=${syntheticStripeEventId}`
        );
        continue;
      }

      console.log('[RECON] Confirming payment...');
      const result = await confirmPayment({
        paymentLinkId,
        provider: 'stripe',
        providerRef: syntheticStripeEventId,
        paymentIntentId,
        checkoutSessionId: session.id,
        amountReceived,
        currencyReceived,
        metadata: {
          reconciledBy: 'stripe-reconciliation-cron',
          reconciledAt: new Date().toISOString(),
          checkoutSessionId: session.id,
          paymentStatus: session.payment_status,
          source: 'reconcile-stripe-payments.ts',
        },
      });

      if (result.success) {
        logRecord(
          paymentLinkId,
          'CONFIRMED_SUCCESS',
          result.alreadyProcessed ? 'confirm_payment_idempotent' : 'confirmed'
        );
      } else {
        logRecord(paymentLinkId, 'ERROR', result.error || 'confirm_payment_failed');
      }
    } catch (error: any) {
      logRecord(
        paymentLinkId,
        'ERROR',
        error instanceof Error ? error.message : 'unknown_error'
      );
    }
  }

  console.log('[RECON] Stripe payment reconciliation completed');
}

run()
  .catch((error: any) => {
    console.error('[RECON] Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
