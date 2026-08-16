import { prisma } from '@/lib/server/prisma';
import { ingestTreasuryEvent } from '@/lib/treasury/events/ingest-treasury-event';
import { digitalSurgeConnector } from '@/lib/treasury/connectors/digital-surge/connector';
import type { ExchangeSyncCursor } from '@/lib/treasury/connectors/exchange-connector.types';
import {
  getDigitalSurgeConnection,
  getDigitalSurgeSyncMetadata,
  markDigitalSurgeSyncResult,
} from '@/lib/treasury/integration/connection-service';
import {
  correlateConversionsForOrganization,
  correlateExchangeDepositsForOrganization,
} from '@/lib/treasury/reconciliation/correlation';
import { loggers } from '@/lib/logger';

const log = loggers.jobs;

export type TreasurySyncResult = {
  organizationId: string;
  ingested: number;
  skipped: number;
  depositsCorrelated: number;
  conversionsCorrelated: number;
  depositAddressesCached: number;
  error?: string;
};

async function attachPaymentLinkFromHash(
  organizationId: string,
  eventId: string,
  transactionHash: string | null | undefined
): Promise<void> {
  if (!transactionHash?.trim()) return;

  const assetReceived = await prisma.treasury_events.findFirst({
    where: {
      organization_id: organizationId,
      event_type: 'ASSET_RECEIVED',
      transaction_hash: transactionHash.toLowerCase(),
      payment_link_id: { not: null },
    },
    select: { payment_link_id: true },
  });

  if (!assetReceived?.payment_link_id) return;

  await prisma.treasury_events.updateMany({
    where: {
      id: eventId,
      organization_id: organizationId,
      payment_link_id: null,
    },
    data: { payment_link_id: assetReceived.payment_link_id },
  });
}

function readSyncCursor(metadata: Record<string, unknown> | null): ExchangeSyncCursor | null {
  const cursor = metadata?.sync_cursor;
  if (!cursor || typeof cursor !== 'object') return null;
  const c = cursor as ExchangeSyncCursor;
  return {
    lastCreatedAt: typeof c.lastCreatedAt === 'string' ? c.lastCreatedAt : null,
    lastSummaryId: typeof c.lastSummaryId === 'number' ? c.lastSummaryId : null,
  };
}

function readKnownDepositAddresses(metadata: Record<string, unknown> | null): Set<string> {
  const raw = metadata?.deposit_addresses;
  if (!raw || typeof raw !== 'object') return new Set();
  const addresses = new Set<string>();
  for (const value of Object.values(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const addr of value) {
        if (typeof addr === 'string' && addr.trim()) {
          addresses.add(addr.trim().toLowerCase());
        }
      }
    }
  }
  return addresses;
}

export async function syncTreasuryForOrganization(
  organizationId: string
): Promise<TreasurySyncResult> {
  const connection = await getDigitalSurgeConnection(organizationId);
  if (!connection) {
    return {
      organizationId,
      ingested: 0,
      skipped: 0,
      depositsCorrelated: 0,
      conversionsCorrelated: 0,
      depositAddressesCached: 0,
    };
  }

  const connectionRow = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: 'digital_surge',
      },
    },
    select: { last_sync_at: true, metadata: true },
  });

  const existingMetadata = (connectionRow?.metadata as Record<string, unknown> | null) ?? null;
  const cursor = readSyncCursor(existingMetadata);

  try {
    const depositAddresses = await digitalSurgeConnector.fetchDepositAddresses({
      organizationId,
    });

    const depositAddressMap: Record<string, string[]> = {};
    for (const row of depositAddresses) {
      const key = row.asset.toUpperCase();
      if (!depositAddressMap[key]) depositAddressMap[key] = [];
      depositAddressMap[key].push(row.address);
    }

    const knownDepositAddresses = new Set(
      depositAddresses.map((a) => a.address.trim().toLowerCase())
    );

    const { records, cursor: nextCursor } = await digitalSurgeConnector.fetchTransactions({
      organizationId,
      since: connectionRow?.last_sync_at ?? null,
      cursor,
    });

    let ingested = 0;
    let skipped = 0;

    for (const record of records) {
      const result = await ingestTreasuryEvent({
        organizationId,
        ...record,
      });

      if (result.created) ingested += 1;
      else skipped += 1;

      await attachPaymentLinkFromHash(organizationId, result.eventId, record.transactionHash);
    }

    const depositsCorrelated = await correlateExchangeDepositsForOrganization(
      organizationId,
      knownDepositAddresses
    );
    const conversionsCorrelated = await correlateConversionsForOrganization(organizationId);

    await markDigitalSurgeSyncResult({
      organizationId,
      error: null,
      metadata: {
        ...existingMetadata,
        sync_cursor: nextCursor,
        deposit_addresses: depositAddressMap,
        deposit_addresses_refreshed_at: new Date().toISOString(),
      },
    });

    log.info('Treasury sync completed', {
      organizationId,
      ingested,
      skipped,
      depositsCorrelated,
      conversionsCorrelated,
      depositAddresses: depositAddresses.length,
    });

    return {
      organizationId,
      ingested,
      skipped,
      depositsCorrelated,
      conversionsCorrelated,
      depositAddressesCached: depositAddresses.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await markDigitalSurgeSyncResult({ organizationId, error: message });
    log.error('Treasury sync failed', error instanceof Error ? error : undefined, {
      organizationId,
    });
    return {
      organizationId,
      ingested: 0,
      skipped: 0,
      depositsCorrelated: 0,
      conversionsCorrelated: 0,
      depositAddressesCached: 0,
      error: message,
    };
  }
}

export async function syncTreasuryForAllConnectedOrganizations(): Promise<TreasurySyncResult[]> {
  const connections = await prisma.treasury_integration_connections.findMany({
    where: { provider: 'digital_surge', status: 'active' },
    select: { organization_id: true },
  });

  const results: TreasurySyncResult[] = [];
  for (const connection of connections) {
    results.push(await syncTreasuryForOrganization(connection.organization_id));
  }
  return results;
}
