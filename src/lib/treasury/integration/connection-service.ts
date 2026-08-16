import { prisma } from '@/lib/server/prisma';
import {
  decryptTreasurySecret,
  encryptTreasurySecret,
  redactApiKeyMaterial,
} from '@/lib/treasury/integration/encryption';
import { TREASURY_PROVIDERS } from '@/lib/treasury/events/types';
import { loggers } from '@/lib/logger';

const log = loggers.jobs;

const DIGITAL_SURGE_PROVIDER = TREASURY_PROVIDERS.DIGITAL_SURGE;

export async function saveDigitalSurgeConnection(params: {
  organizationId: string;
  apiKey: string;
}): Promise<{ id: string; provider: string }> {
  const encrypted = encryptTreasurySecret(params.apiKey.trim());

  const row = await prisma.treasury_integration_connections.upsert({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: DIGITAL_SURGE_PROVIDER,
      },
    },
    create: {
      organization_id: params.organizationId,
      provider: DIGITAL_SURGE_PROVIDER,
      encrypted_api_key: encrypted,
      status: 'active',
    },
    update: {
      encrypted_api_key: encrypted,
      status: 'active',
      last_sync_error: null,
    },
    select: { id: true, provider: true },
  });

  log.info('Digital Surge connection saved', {
    organizationId: params.organizationId,
    apiKeyHint: redactApiKeyMaterial(params.apiKey),
  });

  return row;
}

export async function getDigitalSurgeConnection(
  organizationId: string
): Promise<{ id: string; apiKey: string } | null> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: DIGITAL_SURGE_PROVIDER,
      },
    },
    select: {
      id: true,
      encrypted_api_key: true,
      status: true,
    },
  });

  if (!row || row.status !== 'active') return null;

  return {
    id: row.id,
    apiKey: decryptTreasurySecret(row.encrypted_api_key),
  };
}

export async function getDigitalSurgeConnectionStatus(organizationId: string): Promise<{
  connected: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: DIGITAL_SURGE_PROVIDER,
      },
    },
    select: {
      status: true,
      last_sync_at: true,
      last_sync_error: true,
    },
  });

  return {
    connected: row?.status === 'active',
    lastSyncAt: row?.last_sync_at?.toISOString() ?? null,
    lastSyncError: row?.last_sync_error ?? null,
  };
}

export async function markDigitalSurgeSyncResult(params: {
  organizationId: string;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.treasury_integration_connections.update({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: DIGITAL_SURGE_PROVIDER,
      },
    },
    data: {
      last_sync_at: new Date(),
      last_sync_error: params.error ?? null,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
  });
}

export async function getDigitalSurgeSyncMetadata(
  organizationId: string
): Promise<Record<string, unknown> | null> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: DIGITAL_SURGE_PROVIDER,
      },
    },
    select: { metadata: true },
  });
  return (row?.metadata as Record<string, unknown> | null) ?? null;
}

export async function disconnectDigitalSurge(organizationId: string): Promise<void> {
  await prisma.treasury_integration_connections.deleteMany({
    where: {
      organization_id: organizationId,
      provider: DIGITAL_SURGE_PROVIDER,
    },
  });
}
