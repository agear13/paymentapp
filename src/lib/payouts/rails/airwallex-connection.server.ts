import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  decryptTreasurySecret,
  encryptTreasurySecret,
  redactApiKeyMaterial,
} from '@/lib/treasury/integration/encryption';
import type { AirwallexExecutionCredentials } from '@/lib/payouts/rails/types';
import { log } from '@/lib/logger';

export const AIRWALLEX_CONNECTION_PROVIDER = 'airwallex';

export type AirwallexConnectionMetadata = {
  onBehalfOfAccountId?: string | null;
  loginAsAccountId?: string | null;
  sourceCurrency?: string | null;
  transferMethod?: 'LOCAL' | 'SWIFT' | null;
  transferReason?: string | null;
  feePaidBy?: 'PAYER' | 'BENEFICIARY' | null;
  executionEnabled?: boolean;
  environment?: 'sandbox';
  webhookSecretEncrypted?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isAirwallexPlatformExecutionEnabled(): boolean {
  return process.env.AIRWALLEX_PAYOUTS_ENABLED === 'true';
}

/** Org-stored credentials only. Platform env must not make Airwallex look universally ready. */
export async function isMerchantAirwallexConfigured(organizationId: string): Promise<boolean> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: AIRWALLEX_CONNECTION_PROVIDER,
      },
    },
    select: {
      encrypted_api_key: true,
      status: true,
      metadata: true,
    },
  });
  if (!row || row.status !== 'active' || !row.encrypted_api_key) return false;
  return Boolean(readString(asRecord(row.metadata).clientId));
}

export async function isMerchantAirwallexReady(organizationId: string): Promise<boolean> {
  return (
    (await isMerchantAirwallexConfigured(organizationId)) && isAirwallexPlatformExecutionEnabled()
  );
}

function transferMethodFrom(value: unknown): 'LOCAL' | 'SWIFT' | undefined {
  return value === 'SWIFT' || value === 'LOCAL' ? value : undefined;
}

function feePaidByFrom(value: unknown): 'PAYER' | 'BENEFICIARY' | undefined {
  return value === 'PAYER' || value === 'BENEFICIARY' ? value : undefined;
}

function platformEnvCredentials(): AirwallexExecutionCredentials | null {
  const clientId = process.env.AIRWALLEX_CLIENT_ID?.trim();
  const apiKey = process.env.AIRWALLEX_API_KEY?.trim();
  if (!clientId || !apiKey) return null;
  return {
    clientId,
    apiKey,
    webhookSecret: process.env.AIRWALLEX_WEBHOOK_SECRET?.trim() || null,
    onBehalfOfAccountId: process.env.AIRWALLEX_ON_BEHALF_OF?.trim() || null,
    loginAsAccountId: process.env.AIRWALLEX_LOGIN_AS?.trim() || null,
    sourceCurrency: process.env.AIRWALLEX_SOURCE_CURRENCY?.trim().toUpperCase() || null,
    transferMethod: transferMethodFrom(process.env.AIRWALLEX_TRANSFER_METHOD),
    transferReason: process.env.AIRWALLEX_TRANSFER_REASON?.trim() || null,
    executionEnabled: isAirwallexPlatformExecutionEnabled(),
    environment: 'sandbox',
  };
}

function credentialsFromRow(
  encryptedApiKey: string,
  metadata: AirwallexConnectionMetadata,
  clientId: string
): AirwallexExecutionCredentials | null {
  if (!clientId) return null;
  return {
    clientId,
    apiKey: decryptTreasurySecret(encryptedApiKey),
    webhookSecret: process.env.AIRWALLEX_WEBHOOK_SECRET?.trim() || null,
    onBehalfOfAccountId: metadata.onBehalfOfAccountId ?? null,
    loginAsAccountId: metadata.loginAsAccountId ?? null,
    sourceCurrency: metadata.sourceCurrency ?? null,
    transferMethod: transferMethodFrom(metadata.transferMethod),
    transferReason: metadata.transferReason ?? null,
    feePaidBy: feePaidByFrom(metadata.feePaidBy),
    executionEnabled:
      metadata.executionEnabled === true && isAirwallexPlatformExecutionEnabled(),
    environment: 'sandbox',
  };
}

export async function getAirwallexConnection(
  organizationId: string
): Promise<AirwallexExecutionCredentials | null> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: AIRWALLEX_CONNECTION_PROVIDER,
      },
    },
    select: {
      encrypted_api_key: true,
      status: true,
      metadata: true,
    },
  });

  if (row && row.status === 'active') {
    const metadata = asRecord(row.metadata) as AirwallexConnectionMetadata;
    const clientId = readString(asRecord(row.metadata).clientId) ?? process.env.AIRWALLEX_CLIENT_ID?.trim() ?? '';
    const loaded = credentialsFromRow(row.encrypted_api_key, metadata, clientId);
    if (loaded) return loaded;
  }

  return platformEnvCredentials();
}

export async function getAirwallexWebhookSecret(
  accountId?: string | null
): Promise<string | null> {
  const envSecret = process.env.AIRWALLEX_WEBHOOK_SECRET?.trim();
  if (envSecret) return envSecret;

  const rows = await prisma.treasury_integration_connections.findMany({
    where: { provider: AIRWALLEX_CONNECTION_PROVIDER, status: 'active' },
    select: { metadata: true },
  });
  for (const row of rows) {
    const metadata = asRecord(row.metadata);
    const stored = readString(metadata.webhookSecret);
    if (!stored) continue;
    if (accountId && readString(metadata.onBehalfOfAccountId) && readString(metadata.onBehalfOfAccountId) !== accountId) {
      continue;
    }
    return stored;
  }
  return null;
}

export async function saveAirwallexSandboxConnection(params: {
  organizationId: string;
  clientId: string;
  apiKey: string;
  onBehalfOfAccountId?: string | null;
  loginAsAccountId?: string | null;
  sourceCurrency?: string | null;
  transferMethod?: 'LOCAL' | 'SWIFT' | null;
  transferReason?: string | null;
  executionEnabled?: boolean;
}): Promise<{ id: string }> {
  const metadata = {
    clientId: params.clientId.trim(),
    onBehalfOfAccountId: params.onBehalfOfAccountId ?? null,
    loginAsAccountId: params.loginAsAccountId ?? null,
    sourceCurrency: params.sourceCurrency ?? null,
    transferMethod: params.transferMethod ?? null,
    transferReason: params.transferReason ?? null,
    executionEnabled: params.executionEnabled === true,
    environment: 'sandbox' as const,
  };

  const row = await prisma.treasury_integration_connections.upsert({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: AIRWALLEX_CONNECTION_PROVIDER,
      },
    },
    create: {
      organization_id: params.organizationId,
      provider: AIRWALLEX_CONNECTION_PROVIDER,
      encrypted_api_key: encryptTreasurySecret(params.apiKey.trim()),
      status: 'active',
      metadata,
    },
    update: {
      encrypted_api_key: encryptTreasurySecret(params.apiKey.trim()),
      status: 'active',
      last_sync_error: null,
      metadata,
    },
    select: { id: true },
  });

  log.info('Airwallex sandbox payout connection saved', {
    organizationId: params.organizationId,
    onBehalfOfConfigured: Boolean(params.onBehalfOfAccountId),
    executionEnabled: metadata.executionEnabled,
    apiKeyHint: redactApiKeyMaterial(params.apiKey),
  });

  return row;
}
