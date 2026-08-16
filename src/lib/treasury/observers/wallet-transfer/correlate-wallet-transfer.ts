import { prisma } from '@/lib/server/prisma';
import type { TreasuryEventStatus } from '@prisma/client';
import { ingestTreasuryEventLink } from '@/lib/treasury/events/treasury-event-links';

export type WalletTransferCorrelationResult = {
  linked: boolean;
  linkStatus: TreasuryEventStatus;
  assetReceivedEventId?: string;
  paymentLinkId?: string | null;
  reason: string;
};

/**
 * Link ASSET_RECEIVED → WALLET_TRANSFER using deterministic evidence only.
 *
 * CONFIRMED when there is exactly one unmatched ASSET_RECEIVED for the same
 * org, asset, and merchant wallet (source = prior destination).
 *
 * Never uses amount-only or timestamp-only matching.
 */
export async function correlateWalletTransferToAssetReceived(
  organizationId: string,
  walletTransferEventId: string
): Promise<WalletTransferCorrelationResult> {
  const walletTransfer = await prisma.treasury_events.findFirst({
    where: {
      id: walletTransferEventId,
      organization_id: organizationId,
      event_type: 'WALLET_TRANSFER',
    },
  });

  if (!walletTransfer) {
    return { linked: false, linkStatus: 'UNKNOWN', reason: 'wallet_transfer_not_found' };
  }

  if (!walletTransfer.source_address || !walletTransfer.asset) {
    return { linked: false, linkStatus: 'UNKNOWN', reason: 'missing_wallet_or_asset' };
  }

  const candidates = await prisma.treasury_events.findMany({
    where: {
      organization_id: organizationId,
      event_type: 'ASSET_RECEIVED',
      asset: walletTransfer.asset,
      destination_address: walletTransfer.source_address,
      payment_link_id: { not: null },
    },
    orderBy: { occurred_at: 'asc' },
  });

  const unmatched: typeof candidates = [];

  for (const candidate of candidates) {
    const existingLink = await prisma.treasury_event_links.findFirst({
      where: {
        organization_id: organizationId,
        source_event_id: candidate.id,
        link_type: 'PARENT_CHILD',
        target_event: { event_type: 'WALLET_TRANSFER' },
      },
    });
    if (!existingLink) {
      unmatched.push(candidate);
    }
  }

  if (unmatched.length === 0) {
    return { linked: false, linkStatus: 'UNKNOWN', reason: 'no_unmatched_asset_received' };
  }

  if (unmatched.length > 1) {
    return {
      linked: false,
      linkStatus: 'UNKNOWN',
      reason: 'ambiguous_multiple_asset_received_candidates',
    };
  }

  const assetReceived = unmatched[0];
  const linkStatus: TreasuryEventStatus = 'CONFIRMED';

  await ingestTreasuryEventLink({
    organizationId,
    sourceEventId: assetReceived.id,
    targetEventId: walletTransfer.id,
    linkType: 'PARENT_CHILD',
    linkStatus,
    evidence: {
      strategy: 'unique_unmatched_asset_received_same_wallet_asset',
      asset_received_id: assetReceived.id,
      payment_link_id: assetReceived.payment_link_id,
      payment_event_id: assetReceived.payment_event_id,
    },
  });

  if (!walletTransfer.payment_link_id && assetReceived.payment_link_id) {
    await prisma.treasury_events.update({
      where: { id: walletTransfer.id },
      data: { payment_link_id: assetReceived.payment_link_id },
    });
  }

  return {
    linked: true,
    linkStatus,
    assetReceivedEventId: assetReceived.id,
    paymentLinkId: assetReceived.payment_link_id,
    reason: 'unique_unmatched_asset_received',
  };
}

/** Reject amount-only correlation attempts explicitly. */
export function isAmountOnlyWalletCorrelation(params: {
  matchOnAmountOnly?: boolean;
  matchOnTimestampOnly?: boolean;
}): boolean {
  return Boolean(params.matchOnAmountOnly || params.matchOnTimestampOnly);
}
