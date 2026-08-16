import { prisma } from '@/lib/server/prisma';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import { ingestTreasuryEventLink } from '@/lib/treasury/events/treasury-event-links';
import {
  resolveConfirmedPaymentAsset,
  resolveReceiveWalletContext,
} from '@/lib/treasury/events/resolve-confirmed-asset';
import { TREASURY_PROVIDERS } from '@/lib/treasury/events/types';

export type PaymentConfirmedTreasuryInput = {
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
};

export type PaymentConfirmedTreasuryResult = {
  customerPaymentEventId: string;
  assetReceivedEventId: string;
  customerPaymentLinkId?: string;
  assetReceivedLinkId?: string;
};

function customerPaymentProviderReference(paymentEventId: string): string {
  return `payment_event:${paymentEventId}:customer_payment`;
}

function assetReceivedProviderReference(paymentEventId: string): string {
  return `payment_event:${paymentEventId}:asset_received`;
}

/**
 * Create CUSTOMER_PAYMENT + ASSET_RECEIVED treasury events from PAYMENT_CONFIRMED.
 * Does not alter payment confirmation semantics.
 */
export async function createTreasuryEventsFromPaymentConfirmed(
  input: PaymentConfirmedTreasuryInput
): Promise<PaymentConfirmedTreasuryResult> {
  const asset = resolveConfirmedPaymentAsset({
    provider: input.provider,
    currency: input.currency,
    tokenType: input.tokenType,
    metadata: input.metadata,
  });
  const occurredAt = input.receivedAt ?? new Date();

  const settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: input.organizationId },
    select: {
      evm_wallet_address: true,
      hedera_account_id: true,
    },
  });

  const receiveContext = resolveReceiveWalletContext(
    input.provider,
    input.metadata,
    settings,
    input.sourceReference
  );

  const customerPayment = await ingestTreasuryEvent({
    organizationId: input.organizationId,
    eventType: 'CUSTOMER_PAYMENT',
    status: 'CONFIRMED',
    provider: TREASURY_PROVIDERS.PROVVY,
    providerReference: customerPaymentProviderReference(input.paymentEventId),
    asset,
    amount: input.amount,
    paymentLinkId: input.paymentLinkId,
    paymentEventId: input.paymentEventId,
    occurredAt,
    metadata: {
      source: 'PAYMENT_CONFIRMED',
      payment_provider: input.provider,
      source_reference: input.sourceReference ?? null,
    },
  });

  const assetReceived = await ingestTreasuryEvent({
    organizationId: input.organizationId,
    eventType: 'ASSET_RECEIVED',
    status: 'CONFIRMED',
    provider: receiveContext.assetProvider,
    providerReference: assetReceivedProviderReference(input.paymentEventId),
    asset,
    amount: input.amount,
    walletNetwork: receiveContext.walletNetwork,
    destinationAddress: receiveContext.destinationAddress,
    transactionHash: receiveContext.transactionHash,
    paymentLinkId: input.paymentLinkId,
    paymentEventId: input.paymentEventId,
    parentTreasuryEventId: customerPayment.eventId,
    occurredAt,
    metadata: {
      source: 'PAYMENT_CONFIRMED',
      payment_provider: input.provider,
      source_reference: receiveContext.sourceReference,
      wallet_invented: false,
    },
  });

  const customerToAssetLink = await ingestTreasuryEventLink({
    organizationId: input.organizationId,
    sourceEventId: customerPayment.eventId,
    targetEventId: assetReceived.eventId,
    linkType: 'PARENT_CHILD',
    linkStatus: 'CONFIRMED',
    evidence: {
      relation: 'payment_confirmed_customer_payment_to_asset_received',
      payment_event_id: input.paymentEventId,
      payment_link_id: input.paymentLinkId,
    },
  });

  return {
    customerPaymentEventId: customerPayment.eventId,
    assetReceivedEventId: assetReceived.eventId,
    customerPaymentLinkId: customerToAssetLink.linkId,
  };
}
