import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { fetchEvmOutboundErc20Transfers } from '@/lib/evm/alchemy-outbound.server';
import { normalizeNetworkId, type EvmNetworkId } from '@/lib/evm/networks';
import { fetchHederaOutboundTransfers } from '@/lib/treasury/observers/wallet-transfer/hedera-outbound';
import { ingestObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/ingest-observed-transfer';
import type { ObservedOutboundTransfer } from '@/lib/treasury/observers/wallet-transfer/types';

const log = loggers.jobs;

export type WalletObservationResult = {
  organizationId: string;
  observed: number;
  ingested: number;
  skipped: number;
  linked: number;
  errors: string[];
};

async function observeEvmOutboundForOrganization(params: {
  organizationId: string;
  merchantWalletAddress: string;
  supportedNetworks: string[];
}): Promise<ObservedOutboundTransfer[]> {
  const transfers: ObservedOutboundTransfer[] = [];

  for (const networkRaw of params.supportedNetworks) {
    const networkId = normalizeNetworkId(networkRaw);
    if (!networkId) continue;

    try {
      const outbound = await fetchEvmOutboundErc20Transfers({
        networkId,
        merchantWalletAddress: params.merchantWalletAddress,
      });
      transfers.push(...outbound);
    } catch (error) {
      log.warn('EVM outbound observation failed', {
        organizationId: params.organizationId,
        networkId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return transfers;
}

export async function observeWalletTransfersForOrganization(
  organizationId: string
): Promise<WalletObservationResult> {
  const result: WalletObservationResult = {
    organizationId,
    observed: 0,
    ingested: 0,
    skipped: 0,
    linked: 0,
    errors: [],
  };

  const settings = await prisma.merchant_settings.findFirst({
    where: { organization_id: organizationId },
    select: {
      evm_wallet_address: true,
      evm_wallet_enabled: true,
      evm_supported_networks: true,
      hedera_account_id: true,
    },
  });

  if (!settings) {
    return result;
  }

  const observed: ObservedOutboundTransfer[] = [];

  if (settings.evm_wallet_enabled && settings.evm_wallet_address) {
    const evm = await observeEvmOutboundForOrganization({
      organizationId,
      merchantWalletAddress: settings.evm_wallet_address,
      supportedNetworks: settings.evm_supported_networks ?? ['base', 'ethereum', 'polygon'],
    });
    observed.push(...evm);
  }

  if (settings.hedera_account_id) {
    try {
      const lastTransfer = await prisma.treasury_events.findFirst({
        where: {
          organization_id: organizationId,
          event_type: 'WALLET_TRANSFER',
          wallet_network: 'hedera',
        },
        orderBy: { occurred_at: 'desc' },
        select: { occurred_at: true },
      });

      const hedera = await fetchHederaOutboundTransfers({
        merchantAccountId: settings.hedera_account_id,
        since: lastTransfer?.occurred_at ?? null,
      });
      observed.push(...hedera);
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  result.observed = observed.length;

  for (const transfer of observed) {
    try {
      const ingested = await ingestObservedOutboundTransfer(organizationId, transfer);
      if (ingested.created) result.ingested += 1;
      else result.skipped += 1;
      if (ingested.correlation.linked) result.linked += 1;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  log.info('Wallet treasury observation completed', result);
  return result;
}

export async function observeWalletTransfersForAllOrganizations(): Promise<WalletObservationResult[]> {
  const orgs = await prisma.merchant_settings.findMany({
    where: {
      OR: [
        { evm_wallet_enabled: true, evm_wallet_address: { not: null } },
        { hedera_account_id: { not: null } },
      ],
    },
    select: { organization_id: true },
    distinct: ['organization_id'],
  });

  const results: WalletObservationResult[] = [];
  for (const org of orgs) {
    results.push(await observeWalletTransfersForOrganization(org.organization_id));
  }
  return results;
}

/** Process a single observed transfer (webhook / duplicate path) with org isolation. */
export async function ingestObservedTransferForOrganization(
  organizationId: string,
  transfer: ObservedOutboundTransfer
): Promise<WalletObservationResult> {
  const result: WalletObservationResult = {
    organizationId,
    observed: 1,
    ingested: 0,
    skipped: 0,
    linked: 0,
    errors: [],
  };

  try {
    const ingested = await ingestObservedOutboundTransfer(organizationId, transfer);
    if (ingested.created) result.ingested += 1;
    else result.skipped += 1;
    if (ingested.correlation.linked) result.linked += 1;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}
