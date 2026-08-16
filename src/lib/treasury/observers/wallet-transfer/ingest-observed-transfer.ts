import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import { TREASURY_PROVIDERS } from '@/lib/treasury/events/types';
import { correlateWalletTransferToAssetReceived } from '@/lib/treasury/observers/wallet-transfer/correlate-wallet-transfer';
import type { ObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/types';

export type IngestObservedTransferResult = {
  eventId: string;
  created: boolean;
  correlation: Awaited<ReturnType<typeof correlateWalletTransferToAssetReceived>>;
};

export async function ingestObservedOutboundTransfer(
  organizationId: string,
  transfer: ObservedOutboundTransfer
): Promise<IngestObservedTransferResult> {
  const negativeAmount = transfer.amount.startsWith('-')
    ? transfer.amount
    : `-${transfer.amount}`;

  const ingested = await ingestTreasuryEvent({
    organizationId,
    eventType: 'WALLET_TRANSFER',
    status: 'CONFIRMED',
    provider: TREASURY_PROVIDERS.BLOCKCHAIN,
    providerReference: transfer.providerReference,
    asset: transfer.asset,
    amount: negativeAmount,
    sourceAddress: transfer.sourceAddress,
    destinationAddress: transfer.destinationAddress,
    walletNetwork: transfer.walletNetwork,
    transactionHash: transfer.transactionHash,
    occurredAt: transfer.occurredAt,
    metadata: {
      observation_source: transfer.observationSource,
      confirmation_status: transfer.confirmationStatus,
      outbound: true,
    },
    rawProviderPayload: transfer.rawProviderPayload ?? null,
  });

  const correlation = await correlateWalletTransferToAssetReceived(
    organizationId,
    ingested.eventId
  );

  return {
    eventId: ingested.eventId,
    created: ingested.created,
    correlation,
  };
}
