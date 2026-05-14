/**
 * Canonical payment-link state authority.
 *
 * Architectural guardrails:
 * - Do not directly mutate `payment_links.status` outside this module.
 * - Settlement must transition through this state machine inside a Prisma transaction.
 * - Invalid transitions throw `InvalidPaymentLinkTransitionError` (hard-fail, no silent coercion).
 */

import type { Prisma, PaymentLinkStatus } from '@prisma/client';
import { log } from '@/lib/logger';

export class InvalidPaymentLinkTransitionError extends Error {
  constructor(
    public paymentLinkId: string,
    public from: PaymentLinkStatus,
    public to: PaymentLinkStatus,
    public source: string
  ) {
    super(
      `Invalid payment link state transition from ${from} to ${to} (source=${source})`
    );
    this.name = 'InvalidPaymentLinkTransitionError';
  }
}

type TxClient = Pick<Prisma.TransactionClient, 'payment_links'>;

export interface TransitionPaymentLinkStateParams {
  tx: TxClient;
  paymentLinkId: string;
  targetState: PaymentLinkStatus;
  source: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const ALLOWED_TRANSITIONS: Record<PaymentLinkStatus, PaymentLinkStatus[]> = {
  DRAFT: ['OPEN', 'CANCELED'],
  OPEN: ['PAID', 'PAID_UNVERIFIED', 'REQUIRES_REVIEW', 'EXPIRED', 'CANCELED'],
  PAID_UNVERIFIED: ['PAID', 'OPEN', 'REQUIRES_REVIEW'],
  REQUIRES_REVIEW: ['PAID', 'OPEN'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED', 'OPEN'],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REFUNDED: [],
  EXPIRED: [],
  CANCELED: [],
};

export function isValidTransition(
  from: PaymentLinkStatus,
  to: PaymentLinkStatus
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function getValidNextStates(
  from: PaymentLinkStatus
): PaymentLinkStatus[] {
  return [...(ALLOWED_TRANSITIONS[from] ?? [])];
}

export function isPaymentLinkEditable(status: PaymentLinkStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN';
}

export function isPaymentLinkCancelable(status: PaymentLinkStatus): boolean {
  return status === 'DRAFT' || status === 'OPEN';
}

export async function transitionPaymentLinkState(
  params: TransitionPaymentLinkStateParams
) {
  const { tx, paymentLinkId, targetState, source, reason, metadata } = params;

  const paymentLink = await tx.payment_links.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      status: true,
      organization_id: true,
      short_code: true,
      invoice_reference: true,
    },
  });

  if (!paymentLink) {
    throw new Error(`Payment link ${paymentLinkId} not found`);
  }

  const now = new Date();

  // No-op if already in the desired state.
  if (paymentLink.status === targetState) {
    log.info('Payment link already in target state (no-op)', {
      paymentLinkId,
      status: targetState,
      source,
      reason,
      at: now.toISOString(),
    });
    return paymentLink;
  }

  const isAllowed = isValidTransition(paymentLink.status, targetState);

  if (!isAllowed) {
    log.error(
      'Invalid payment link state transition attempt',
      undefined,
      {
        paymentLinkId,
        from: paymentLink.status,
        to: targetState,
        source,
        reason,
        at: now.toISOString(),
        metadata,
      }
    );
    throw new InvalidPaymentLinkTransitionError(
      paymentLinkId,
      paymentLink.status,
      targetState,
      source
    );
  }

  const updated = await tx.payment_links.update({
    where: { id: paymentLinkId },
    data: {
      status: targetState,
      updated_at: now,
    },
  });

  log.info('Payment link state transitioned', {
    paymentLinkId,
    from: paymentLink.status,
    to: targetState,
    source,
    reason,
    at: now.toISOString(),
    metadata,
  });

  return updated;
}

