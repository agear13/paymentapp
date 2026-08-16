import { loggers } from '@/lib/logger';
import { createTreasuryEventsFromPaymentConfirmed } from '@/lib/treasury/events/from-payment-confirmed';

const log = loggers.payment;

/**
 * Non-blocking treasury hook — failures must not affect payment confirmation.
 */
export function hookTreasuryFromPaymentConfirmation(params: {
  organizationId: string;
  paymentLinkId: string;
  paymentEventId: string;
  provider: string;
  currency: string;
  amount: string | number;
  tokenType?: string | null;
  sourceReference?: string | null;
  metadata?: Record<string, unknown> | null;
  receivedAt?: Date | null;
}): void {
  void (async () => {
    try {
      const result = await createTreasuryEventsFromPaymentConfirmed({
        organizationId: params.organizationId,
        paymentLinkId: params.paymentLinkId,
        paymentEventId: params.paymentEventId,
        provider: params.provider,
        currency: params.currency,
        amount: params.amount,
        tokenType: params.tokenType,
        sourceReference: params.sourceReference,
        metadata: params.metadata,
        receivedAt: params.receivedAt,
      });

      log.info('Treasury events created from PAYMENT_CONFIRMED', {
        paymentEventId: params.paymentEventId,
        paymentLinkId: params.paymentLinkId,
        customerPaymentEventId: result.customerPaymentEventId,
        assetReceivedEventId: result.assetReceivedEventId,
      });
    } catch (error: unknown) {
      log.error(
        'Treasury hook failed (non-blocking)',
        error instanceof Error ? error : undefined,
        {
          paymentEventId: params.paymentEventId,
          paymentLinkId: params.paymentLinkId,
          provider: params.provider,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  })();
}
