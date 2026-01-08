/**
 * Beta Ops Queries
 * Database queries for the beta operations panel
 */

import { prisma } from '@/lib/server/prisma';

export interface StripeWebhookEvent {
  id: string;
  stripe_event_id: string;
  payment_link_id: string;
  event_type: string;
  payment_method: string | null;
  amount_received: number | null;
  created_at: Date;
  correlation_id: string | null;
  payment_link?: {
    short_code: string;
    organization_id: string;
  };
}

export interface HederaConfirmation {
  id: string;
  hedera_tx_id: string;
  payment_link_id: string;
  event_type: string;
  amount_received: number | null;
  currency_received: string | null;
  created_at: Date;
  correlation_id: string | null;
  payment_link?: {
    short_code: string;
    organization_id: string;
  };
}

export interface XeroSyncAttempt {
  id: string;
  payment_link_id: string;
  sync_type: string;
  status: string;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
  correlation_id: string | null;
  payment_link?: {
    short_code: string;
    organization_id: string;
  };
}

/**
 * Get recent Stripe webhook events
 */
export async function getRecentStripeWebhooks(limit = 50) {
  const events = await prisma.payment_events.findMany({
    where: {
      stripe_event_id: {
        not: null,
      },
    },
    include: {
      payment_links: {
        select: {
          short_code: true,
          organization_id: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    stripe_event_id: event.stripe_event_id!,
    payment_link_id: event.payment_link_id,
    event_type: event.event_type,
    payment_method: event.payment_method,
    amount_received: event.amount_received 
      ? Number(event.amount_received) 
      : null,
    created_at: event.created_at,
    correlation_id: event.correlation_id,
    payment_link: event.payment_links,
  })) as StripeWebhookEvent[];
}

/**
 * Get recent Hedera confirmations
 */
export async function getRecentHederaConfirmations(limit = 50) {
  const events = await prisma.payment_events.findMany({
    where: {
      hedera_tx_id: {
        not: null,
      },
    },
    include: {
      payment_links: {
        select: {
          short_code: true,
          organization_id: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });

  return events.map((event) => ({
    id: event.id,
    hedera_tx_id: event.hedera_tx_id!,
    payment_link_id: event.payment_link_id,
    event_type: event.event_type,
    amount_received: event.amount_received 
      ? Number(event.amount_received) 
      : null,
    currency_received: event.currency_received,
    created_at: event.created_at,
    correlation_id: event.correlation_id,
    payment_link: event.payment_links,
  })) as HederaConfirmation[];
}

/**
 * Get recent Xero sync attempts
 */
export async function getRecentXeroSyncs(limit = 50) {
  const syncs = await prisma.xero_syncs.findMany({
    include: {
      payment_links: {
        select: {
          short_code: true,
          organization_id: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });

  return syncs.map((sync) => ({
    id: sync.id,
    payment_link_id: sync.payment_link_id,
    sync_type: sync.sync_type,
    status: sync.status,
    error_message: sync.error_message,
    created_at: sync.created_at,
    updated_at: sync.updated_at,
    correlation_id: sync.correlation_id,
    payment_link: sync.payment_links,
  })) as XeroSyncAttempt[];
}

/**
 * Search by payment link ID across all event types
 */
export async function searchByPaymentLink(paymentLinkId: string) {
  const [stripeEvents, hederaEvents, xeroSyncs, paymentLink] = await Promise.all([
    prisma.payment_events.findMany({
      where: {
        payment_link_id: paymentLinkId,
        stripe_event_id: { not: null },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.payment_events.findMany({
      where: {
        payment_link_id: paymentLinkId,
        hedera_tx_id: { not: null },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.xero_syncs.findMany({
      where: { payment_link_id: paymentLinkId },
      orderBy: { created_at: 'desc' },
    }),
    prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      include: {
        organizations: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    paymentLink,
    stripeEvents,
    hederaEvents,
    xeroSyncs,
  };
}

/**
 * Search by correlation ID
 */
export async function searchByCorrelationId(correlationId: string) {
  const [paymentEvents, ledgerEntries, xeroSyncs] = await Promise.all([
    prisma.payment_events.findMany({
      where: { correlation_id: correlationId },
      include: {
        payment_links: true,
      },
    }),
    prisma.ledger_entries.findMany({
      where: { correlation_id: correlationId },
      include: {
        ledger_accounts: true,
      },
    }),
    prisma.xero_syncs.findMany({
      where: { correlation_id: correlationId },
      include: {
        payment_links: true,
      },
    }),
  ]);

  return {
    paymentEvents,
    ledgerEntries,
    xeroSyncs,
  };
}

/**
 * Get statistics for beta ops dashboard
 */
export async function getBetaOpsStats() {
  const [
    totalPaymentEvents,
    stripeEvents,
    hederaEvents,
    xeroSyncs,
    xeroSyncsPending,
    xeroSyncsFailed,
  ] = await Promise.all([
    prisma.payment_events.count(),
    prisma.payment_events.count({
      where: { stripe_event_id: { not: null } },
    }),
    prisma.payment_events.count({
      where: { hedera_tx_id: { not: null } },
    }),
    prisma.xero_syncs.count(),
    prisma.xero_syncs.count({
      where: { status: 'PENDING' },
    }),
    prisma.xero_syncs.count({
      where: { status: 'FAILED' },
    }),
  ]);

  return {
    totalPaymentEvents,
    stripeEvents,
    hederaEvents,
    xeroSyncs: {
      total: xeroSyncs,
      pending: xeroSyncsPending,
      failed: xeroSyncsFailed,
    },
  };
}

