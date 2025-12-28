/**
 * Stripe Webhook Utilities
 * Webhook signature verification and event processing
 */

import Stripe from 'stripe';
import { stripe } from './client';
import { log } from '@/lib/logger';

/**
 * Verify webhook signature and construct event
 */
export async function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Promise<Stripe.Event | null> {
  try {
    // Read secret dynamically from environment
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    
    // Check if webhook processing is disabled
    if (!secret || secret.toLowerCase() === 'disabled') {
      log.warn('Stripe webhook secret missing or disabled - cannot verify signature');
      return null;
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      secret
    );

    log.info(
      {
        eventId: event.id,
        eventType: event.type,
      },
      'Webhook signature verified'
    );

    return event;
  } catch (error: any) {
    log.error(
      {
        error: error.message,
      },
      'Webhook signature verification failed'
    );
    return null;
  }
}

/**
 * Check if webhook event has already been processed (idempotency)
 */
export async function isEventProcessed(
  eventId: string,
  prisma: any
): Promise<boolean> {
  const existingEvent = await prisma.payment_events.findFirst({
    where: {
      metadata: {
        path: ['stripeEventId'],
        equals: eventId,
      },
    },
  });

  return !!existingEvent;
}

/**
 * Extract payment link ID from Stripe metadata
 */
export function extractPaymentLinkId(
  metadata?: Stripe.Metadata | null
): string | null {
  if (!metadata || !metadata.payment_link_id) {
    log.warn('Payment link ID not found in Stripe metadata');
    return null;
  }

  return metadata.payment_link_id;
}

/**
 * Extract organization ID from Stripe metadata
 */
export function extractOrganizationId(
  metadata?: Stripe.Metadata | null
): string | null {
  if (!metadata || !metadata.organization_id) {
    log.warn('Organization ID not found in Stripe metadata');
    return null;
  }

  return metadata.organization_id;
}




