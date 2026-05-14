/**
 * Stripe reconciliation: list recent checkout.session.completed + payment_intent.succeeded
 * events and re-run confirmPayment when our DB shows no matching confirmation.
 *
 * Settlement architecture note:
 * - Reconciliation never writes PAYMENT_CONFIRMED directly.
 * - Reconciliation is replay-safe only because it funnels settlement through confirmPayment().
 *
 * Cursor: persisted under STRIPE_RECONCILIATION_CURSOR_DIR (default os.tmpdir()) as JSON.
 * If missing/unreadable, defaults to a 15-minute lookback with overlap on subsequent runs.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '@/lib/server/prisma';
import { stripe, isStripeEnabled, fromSmallestUnit } from '@/lib/stripe/client';
import { extractPaymentLinkId } from '@/lib/stripe/webhook';
import { confirmPayment } from '@/lib/services/payment-confirmation';
import { generateCorrelationId } from '@/lib/services/correlation';
import { loggers } from '@/lib/logger';
import { validateLedgerInvariant } from '@/lib/ledger/invariant-checker';

const CURSOR_FILENAME = 'stripe-reconciliation-cursor.json';
const DEFAULT_LOOKBACK_SEC = 15 * 60;
const OVERLAP_SEC = 120;
const DEFAULT_MAX_EVENTS_PER_RUN = 300;
const DEFAULT_MAX_ERRORS_PER_RUN = 50;

const RECON_EVENT_TYPES = [
  'checkout.session.completed',
  'payment_intent.succeeded',
] as const;
let warnedAboutLocalCursor = false;

type ReconEventType = (typeof RECON_EVENT_TYPES)[number];

interface CursorFile {
  lastRunEndUnix: number;
}

function getCursorPath(): string {
  const dir = process.env.STRIPE_RECONCILIATION_CURSOR_DIR?.trim() || os.tmpdir();
  if (!process.env.STRIPE_RECONCILIATION_CURSOR_DIR && !warnedAboutLocalCursor) {
    warnedAboutLocalCursor = true;
    loggers.jobs.warn('Stripe reconciliation cursor using local tmpdir (non-shared across instances)', {
      dir,
    });
  }
  return path.join(dir, CURSOR_FILENAME);
}

async function readCursorLastEnd(): Promise<number | null> {
  try {
    const raw = await fs.readFile(getCursorPath(), 'utf8');
    const j = JSON.parse(raw) as CursorFile;
    return typeof j.lastRunEndUnix === 'number' && Number.isFinite(j.lastRunEndUnix)
      ? j.lastRunEndUnix
      : null;
  } catch {
    return null;
  }
}

async function writeCursorLastEnd(lastRunEndUnix: number): Promise<void> {
  const p = getCursorPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify({ lastRunEndUnix } satisfies CursorFile), 'utf8');
}

async function listAllStripeEvents(params: {
  createdGte: number;
  createdLte: number;
  type: ReconEventType;
}): Promise<Stripe.Event[]> {
  const out: Stripe.Event[] = [];
  let starting_after: string | undefined;
  for (;;) {
    const page = await stripe.events.list({
      created: { gte: params.createdGte, lte: params.createdLte },
      type: params.type,
      limit: 100,
      starting_after,
    });
    out.push(...page.data);
    if (!page.has_more) break;
    const last = page.data[page.data.length - 1];
    if (!last?.id) break;
    starting_after = last.id;
  }
  return out;
}

export interface ReconciliationExtract {
  stripeEventId: string;
  externalId: string;
  paymentLinkId: string | null;
  eventType: ReconEventType;
}

export function extractReconciliationIdentifiers(event: Stripe.Event): ReconciliationExtract | null {
  const stripeEventId = event.id;
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentLinkId = extractPaymentLinkId(session.metadata);
    return {
      stripeEventId,
      externalId: session.id,
      paymentLinkId,
      eventType: 'checkout.session.completed',
    };
  }
  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentLinkId = extractPaymentLinkId(pi.metadata);
    return {
      stripeEventId,
      externalId: pi.id,
      paymentLinkId,
      eventType: 'payment_intent.succeeded',
    };
  }
  return null;
}

/**
 * True if this Stripe success event is already reflected in our DB (no confirmPayment needed).
 * Maps "externalId" to: Checkout Session id → metadata.checkoutSessionId / PI id → stripe_payment_intent_id.
 * There is no payment_events.external_id column in schema.
 */
export async function isStripeSuccessEventAlreadyProcessed(params: {
  stripeEventId: string;
  externalId: string;
  paymentLinkId: string | null;
}): Promise<boolean> {
  const { stripeEventId, externalId, paymentLinkId } = params;

  if (paymentLinkId) {
    const link = await prisma.payment_links.findUnique({
      where: { id: paymentLinkId },
      select: { status: true },
    });
    if (link?.status === 'PAID') {
      return true;
    }
  }

  const conditions: Prisma.payment_eventsWhereInput[] = [
    { stripe_event_id: stripeEventId },
    { source_reference: stripeEventId },
    {
      metadata: {
        path: ['stripeEventId'],
        equals: stripeEventId,
      },
    },
  ];

  if (externalId.startsWith('pi_')) {
    conditions.push({ stripe_payment_intent_id: externalId });
  }
  if (externalId.startsWith('cs_')) {
    conditions.push({
      metadata: {
        path: ['checkoutSessionId'],
        equals: externalId,
      },
    });
  }

  const existing = await prisma.payment_events.findFirst({
    where: {
      event_type: 'PAYMENT_CONFIRMED',
      OR: conditions,
    },
    select: { id: true },
  });

  return !!existing;
}

async function confirmFromCheckoutEvent(
  event: Stripe.Event,
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  const session = event.data.object as Stripe.Checkout.Session;
  const paymentLinkId = extractPaymentLinkId(session.metadata);
  if (!paymentLinkId) {
    return { success: false, error: 'missing_payment_link_id' };
  }
  const piRef = session.payment_intent;
  const paymentIntentId =
    typeof piRef === 'string' ? piRef : (piRef as Stripe.PaymentIntent | null)?.id;
  if (!paymentIntentId) {
    return { success: false, error: 'missing_payment_intent_on_session' };
  }
  const amountReceived = session.amount_total ? session.amount_total / 100 : 0;
  const currencyReceived = session.currency?.toUpperCase() || 'USD';

  const result = await confirmPayment({
    paymentLinkId,
    provider: 'stripe',
    providerRef: event.id,
    paymentIntentId,
    checkoutSessionId: session.id,
    amountReceived,
    currencyReceived,
    correlationId,
    metadata: {
      checkoutSessionId: session.id,
      customerEmail: session.customer_email,
      paymentStatus: session.payment_status,
      sessionMode: session.mode,
      sessionUrl: session.url,
      ...(session.metadata || {}),
    },
  });

  if (!result.success) {
    return { success: false, error: result.error || 'confirmPayment_failed' };
  }
  return { success: true };
}

async function confirmFromPaymentIntentEvent(
  event: Stripe.Event,
  correlationId: string
): Promise<{ success: boolean; error?: string }> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const paymentLinkId = extractPaymentLinkId(paymentIntent.metadata);
  if (!paymentLinkId) {
    return { success: false, error: 'missing_payment_link_id' };
  }
  const amountReceived = fromSmallestUnit(
    paymentIntent.amount_received || paymentIntent.amount,
    paymentIntent.currency
  );
  const piMeta =
    paymentIntent.metadata &&
    typeof paymentIntent.metadata === 'object' &&
    !Array.isArray(paymentIntent.metadata)
      ? (paymentIntent.metadata as Record<string, string>)
      : {};

  const result = await confirmPayment({
    paymentLinkId,
    provider: 'stripe',
    providerRef: event.id,
    paymentIntentId: paymentIntent.id,
    amountReceived,
    currencyReceived: paymentIntent.currency.toUpperCase(),
    correlationId,
    metadata: {
      paymentIntentId: paymentIntent.id,
      stripeStatus: paymentIntent.status,
      payment_method_types: paymentIntent.payment_method_types,
      receipt_email: paymentIntent.receipt_email,
      customer: paymentIntent.customer,
      ...piMeta,
    },
  });

  if (!result.success) {
    return { success: false, error: result.error || 'confirmPayment_failed' };
  }
  return { success: true };
}

export interface StripeReconciliationJobResult {
  success: boolean;
  message?: string;
  data?: {
    windowStartSec: number;
    windowEndSec: number;
    eventsSeen: number;
    triggered: number;
    skipped: number;
    skippedNoPaymentLink: number;
    errors: { stripeEventId: string; error: string }[];
    hasMore?: boolean;
    lagSeconds?: number;
  };
  duration: number;
}

export async function runStripeReconciliationJob(): Promise<StripeReconciliationJobResult> {
  const started = Date.now();

  if (!isStripeEnabled) {
    return {
      success: true,
      message: 'Stripe disabled; reconciliation skipped',
      data: {
        windowStartSec: 0,
        windowEndSec: 0,
        eventsSeen: 0,
        triggered: 0,
        skipped: 0,
        skippedNoPaymentLink: 0,
        errors: [],
      },
      duration: Date.now() - started,
    };
  }

  const endSec = Math.floor(Date.now() / 1000);
  const lastEnd = await readCursorLastEnd();
  const startSec =
    lastEnd != null ? Math.max(0, lastEnd - OVERLAP_SEC) : endSec - DEFAULT_LOOKBACK_SEC;
  const maxEventsPerRun =
    Number.parseInt(process.env.STRIPE_RECON_MAX_EVENTS_PER_RUN || String(DEFAULT_MAX_EVENTS_PER_RUN), 10) ||
    DEFAULT_MAX_EVENTS_PER_RUN;
  const maxErrorsPerRun =
    Number.parseInt(process.env.STRIPE_RECON_MAX_ERRORS_PER_RUN || String(DEFAULT_MAX_ERRORS_PER_RUN), 10) ||
    DEFAULT_MAX_ERRORS_PER_RUN;

  if (startSec >= endSec) {
    return {
      success: true,
      message: 'Empty time window',
      data: {
        windowStartSec: startSec,
        windowEndSec: endSec,
        eventsSeen: 0,
        triggered: 0,
        skipped: 0,
        skippedNoPaymentLink: 0,
        errors: [],
      },
      duration: Date.now() - started,
    };
  }

  const allEvents: Stripe.Event[] = [];
  for (const t of RECON_EVENT_TYPES) {
    const batch = await listAllStripeEvents({
      createdGte: startSec,
      createdLte: endSec,
      type: t,
    });
    allEvents.push(...batch);
  }

  const byId = new Map<string, Stripe.Event>();
  for (const ev of allEvents) {
    byId.set(ev.id, ev);
  }
  const merged = Array.from(byId.values()).sort((a, b) => a.created - b.created);
  const budgeted = merged.slice(0, maxEventsPerRun);
  const hasMore = merged.length > budgeted.length;

  let triggered = 0;
  let skipped = 0;
  let skippedNoPaymentLink = 0;
  const errors: { stripeEventId: string; error: string }[] = [];

  for (const event of budgeted) {
    const extracted = extractReconciliationIdentifiers(event);
    if (!extracted) continue;

    const { stripeEventId, externalId, paymentLinkId } = extracted;

    if (!paymentLinkId) {
      skippedNoPaymentLink += 1;
      loggers.jobs.info('Reconciliation skipped (no payment_link_id in Stripe metadata)', {
        msg: 'Reconciliation skipped (no payment_link_id in Stripe metadata)',
        stripeEventId,
        externalId,
      });
      continue;
    }

    const already = await isStripeSuccessEventAlreadyProcessed({
      stripeEventId,
      externalId,
      paymentLinkId,
    });

    if (already) {
      skipped += 1;
      loggers.jobs.info('Reconciliation skipped (already processed)', {
        msg: 'Reconciliation skipped (already processed)',
        stripeEventId,
        externalId,
        paymentLinkId,
      });
      continue;
    }

    const correlationId = generateCorrelationId('stripe', `recon_${stripeEventId}`);

    let outcome: { success: boolean; error?: string };
    if (event.type === 'checkout.session.completed') {
      outcome = await confirmFromCheckoutEvent(event, correlationId);
    } else {
      outcome = await confirmFromPaymentIntentEvent(event, correlationId);
    }

    if (!outcome.success) {
      errors.push({ stripeEventId, error: outcome.error || 'unknown' });
      loggers.jobs.error(
        'Reconciliation confirmPayment failed',
        undefined,
        {
          msg: 'Reconciliation confirmPayment failed',
          stripeEventId,
          externalId,
          paymentLinkId,
          error: outcome.error,
        }
      );
      if (errors.length >= maxErrorsPerRun) {
        loggers.jobs.warn('Reconciliation stopping early due to error budget', {
          maxErrorsPerRun,
          errors: errors.length,
        });
        break;
      }
      continue;
    }

    triggered += 1;
    const invariantRows = await validateLedgerInvariant(paymentLinkId);
    const imbalance = invariantRows.find((r) => !r.balanced);
    if (imbalance) {
      loggers.jobs.error(
        'Reconciliation detected ledger imbalance after confirmPayment',
        undefined,
        {
          stripeEventId,
          externalId,
          paymentLinkId,
          currency: imbalance.currency,
          debitTotal: imbalance.debitTotal,
          creditTotal: imbalance.creditTotal,
          difference: imbalance.difference,
        }
      );
    }
    loggers.jobs.info('Reconciliation triggered confirmPayment', {
      msg: 'Reconciliation triggered confirmPayment',
      stripeEventId,
      externalId,
      paymentLinkId,
    });

    // Light jitter to avoid bursty contention on DB/provider in dense windows.
    await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 40)));
  }

  const success = errors.length === 0;
  const processedUntilSec =
    budgeted.length > 0 ? budgeted[budgeted.length - 1].created : endSec;
  const cursorAdvanceSec = hasMore ? processedUntilSec : endSec;
  if (success) {
    await writeCursorLastEnd(cursorAdvanceSec);
  }

  const lagSeconds = endSec - startSec;
  loggers.jobs.info('Stripe reconciliation window metrics', {
    windowStartSec: startSec,
    windowEndSec: endSec,
    lagSeconds,
    eventsSeen: merged.length,
    eventsBudgeted: budgeted.length,
    hasMore,
    cursorAdvanceSec,
    lastCursorSec: lastEnd,
  });

  return {
    success,
    message: success
      ? 'Stripe reconciliation completed'
      : 'Stripe reconciliation completed with errors (cursor not advanced)',
    data: {
      windowStartSec: startSec,
      windowEndSec: endSec,
      eventsSeen: merged.length,
      triggered,
      skipped,
      skippedNoPaymentLink,
      errors,
      hasMore,
      lagSeconds,
    },
    duration: Date.now() - started,
  };
}
