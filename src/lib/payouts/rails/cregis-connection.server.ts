import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  decryptTreasurySecret,
  encryptTreasurySecret,
  redactApiKeyMaterial,
} from '@/lib/treasury/integration/encryption';
import type { CregisExecutionCredentials } from '@/lib/payouts/rails/types';
import { assessCregisGatewayLooksProduction } from '@/lib/payouts/rails/cregis-gateway';
import {
  isCregisConnectionSelectable,
  type CregisConnectionSnapshot,
} from '@/lib/payouts/rails/cregis-preflight';
import { log } from '@/lib/logger';

export const CREGIS_CONNECTION_PROVIDER = 'cregis';

export type CregisConnectionMetadata = {
  pid?: number;
  gatewayBaseUrl?: string;
  walletId?: number | null;
  fromAddress?: string | null;
  callbackUrl?: string | null;
  executionEnabled?: boolean;
  environment?: 'sandbox' | 'production';
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function platformEnvCredentials(): CregisExecutionCredentials | null {
  const apiKey = process.env.CREGIS_API_KEY?.trim();
  const gatewayBaseUrl = process.env.CREGIS_GATEWAY_URL?.trim();
  const pid = readNumber(process.env.CREGIS_PID);
  if (!apiKey || !gatewayBaseUrl || pid == null) return null;
  const environment =
    process.env.CREGIS_ENVIRONMENT?.trim() === 'production' ? 'production' : 'sandbox';
  return {
    apiKey,
    pid,
    gatewayBaseUrl: gatewayBaseUrl.replace(/\/+$/, ''),
    walletId: readNumber(process.env.CREGIS_WALLET_ID),
    fromAddress: process.env.CREGIS_FROM_ADDRESS?.trim() || null,
    callbackUrl: process.env.CREGIS_CALLBACK_URL?.trim() || defaultCregisCallbackUrl(),
    executionEnabled: environmentAllowsExecution(environment),
    environment,
  };
}

export function isCregisPlatformExecutionEnabled(): boolean {
  return process.env.CREGIS_PAYOUTS_ENABLED === 'true';
}

export function isCregisProductionExecutionEnabled(): boolean {
  return process.env.CREGIS_PRODUCTION_PAYOUTS_ENABLED === 'true';
}

export function defaultCregisCallbackUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  return base ? `${base}/api/payouts/webhooks/cregis` : null;
}

function environmentAllowsExecution(environment: 'sandbox' | 'production' | null | undefined): boolean {
  if (!isCregisPlatformExecutionEnabled()) return false;
  if (environment === 'production') return isCregisProductionExecutionEnabled();
  return true;
}

function credentialsFromRow(
  encryptedApiKey: string,
  metadata: CregisConnectionMetadata
): CregisExecutionCredentials | null {
  const pid = readNumber(metadata.pid);
  const gatewayBaseUrl =
    typeof metadata.gatewayBaseUrl === 'string' ? metadata.gatewayBaseUrl.replace(/\/+$/, '') : '';
  if (pid == null || !gatewayBaseUrl) return null;
  return {
    apiKey: decryptTreasurySecret(encryptedApiKey),
    pid,
    gatewayBaseUrl,
    walletId: readNumber(metadata.walletId),
    fromAddress: metadata.fromAddress ?? null,
    callbackUrl: metadata.callbackUrl ?? defaultCregisCallbackUrl(),
    executionEnabled:
      metadata.executionEnabled === true && environmentAllowsExecution(metadata.environment),
    environment: metadata.environment === 'production' ? 'production' : 'sandbox',
  };
}

export async function saveCregisConnection(params: {
  organizationId: string;
  apiKey: string;
  pid: number;
  gatewayBaseUrl: string;
  walletId?: number | null;
  fromAddress?: string | null;
  callbackUrl?: string | null;
  executionEnabled?: boolean;
  environment?: 'sandbox' | 'production';
}): Promise<{ id: string }> {
  const metadata: CregisConnectionMetadata = {
    pid: params.pid,
    gatewayBaseUrl: params.gatewayBaseUrl.replace(/\/+$/, ''),
    walletId: params.walletId ?? null,
    fromAddress: params.fromAddress ?? null,
    callbackUrl: params.callbackUrl ?? null,
    executionEnabled: params.executionEnabled === true,
    environment: params.environment ?? 'sandbox',
  };

  const row = await prisma.treasury_integration_connections.upsert({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: CREGIS_CONNECTION_PROVIDER,
      },
    },
    create: {
      organization_id: params.organizationId,
      provider: CREGIS_CONNECTION_PROVIDER,
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

  log.info('Cregis payout connection saved', {
    organizationId: params.organizationId,
    pid: params.pid,
    environment: metadata.environment,
    executionEnabled: metadata.executionEnabled,
    apiKeyHint: redactApiKeyMaterial(params.apiKey),
  });

  return row;
}

export async function getCregisConnection(
  organizationId: string
): Promise<CregisExecutionCredentials | null> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: CREGIS_CONNECTION_PROVIDER,
      },
    },
    select: {
      encrypted_api_key: true,
      status: true,
      metadata: true,
    },
  });

  if (row && row.status === 'active') {
    const loaded = credentialsFromRow(
      row.encrypted_api_key,
      asRecord(row.metadata) as CregisConnectionMetadata
    );
    if (loaded) return loaded;
  }

  const env = platformEnvCredentials();
  if (!env) return null;
  return {
    ...env,
    executionEnabled: env.executionEnabled,
  };
}

export async function getCregisConnectionByPid(
  pid: number
): Promise<CregisExecutionCredentials | null> {
  const rows = await prisma.treasury_integration_connections.findMany({
    where: {
      provider: CREGIS_CONNECTION_PROVIDER,
      status: 'active',
    },
    select: {
      encrypted_api_key: true,
      metadata: true,
    },
  });

  for (const row of rows) {
    const metadata = asRecord(row.metadata) as CregisConnectionMetadata;
    if (readNumber(metadata.pid) !== pid) continue;
    const loaded = credentialsFromRow(row.encrypted_api_key, metadata);
    if (loaded) return loaded;
  }

  const env = platformEnvCredentials();
  if (env && env.pid === pid) return env;
  return null;
}

export type CregisConnectionInspection = CregisConnectionSnapshot & {
  gatewayBaseUrl: string | null;
  source: 'organization' | 'platform_env' | null;
};

function snapshotFromCredentials(
  credentials: CregisExecutionCredentials,
  source: 'organization' | 'platform_env',
  connectionExecutionEnabled: boolean
): CregisConnectionInspection {
  const environment = credentials.environment ?? 'sandbox';
  return {
    connected: true,
    hasApiKey: Boolean(credentials.apiKey?.trim()),
    hasGateway: Boolean(credentials.gatewayBaseUrl?.trim()),
    pid: credentials.pid,
    environment,
    connectionExecutionEnabled,
    effectiveExecutionEnabled: credentials.executionEnabled,
    gatewayLooksProduction: assessCregisGatewayLooksProduction(credentials.gatewayBaseUrl),
    gatewayBaseUrl: credentials.gatewayBaseUrl,
    source,
  };
}

export async function inspectCregisConnection(
  organizationId: string
): Promise<CregisConnectionInspection> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: organizationId,
        provider: CREGIS_CONNECTION_PROVIDER,
      },
    },
    select: {
      encrypted_api_key: true,
      status: true,
      metadata: true,
    },
  });

  if (row && row.status === 'active') {
    const metadata = asRecord(row.metadata) as CregisConnectionMetadata;
    const pid = readNumber(metadata.pid);
    const gatewayBaseUrl =
      typeof metadata.gatewayBaseUrl === 'string' ? metadata.gatewayBaseUrl.replace(/\/+$/, '') : '';
    const environment = metadata.environment === 'production' ? 'production' : 'sandbox';
    return {
      connected: true,
      hasApiKey: Boolean(row.encrypted_api_key),
      hasGateway: Boolean(gatewayBaseUrl),
      pid,
      environment,
      connectionExecutionEnabled: metadata.executionEnabled === true,
      effectiveExecutionEnabled:
        metadata.executionEnabled === true && environmentAllowsExecution(environment),
      gatewayLooksProduction: assessCregisGatewayLooksProduction(gatewayBaseUrl),
      gatewayBaseUrl: gatewayBaseUrl || null,
      source: 'organization',
    };
  }

  const env = platformEnvCredentials();
  if (env) {
    return snapshotFromCredentials(env, 'platform_env', env.executionEnabled);
  }

  return {
    connected: false,
    hasApiKey: false,
    hasGateway: false,
    pid: null,
    environment: null,
    connectionExecutionEnabled: false,
    effectiveExecutionEnabled: false,
    gatewayLooksProduction: null,
    gatewayBaseUrl: null,
    source: null,
  };
}

/**
 * Credentials + sandbox (or production with the production flag).
 * Does not require executionEnabled — that gate belongs to execute, not selection.
 */
export async function isMerchantCregisSelectable(organizationId: string): Promise<boolean> {
  const inspection = await inspectCregisConnection(organizationId);
  return isCregisConnectionSelectable(inspection, isCregisProductionExecutionEnabled());
}

/** Platform + org execution gates. Required before POST /api/payouts/{id}/execute. */
export async function isMerchantCregisReady(organizationId: string): Promise<boolean> {
  if (!isCregisPlatformExecutionEnabled()) return false;
  const connection = await getCregisConnection(organizationId);
  return Boolean(connection?.executionEnabled && connection.apiKey && connection.gatewayBaseUrl);
}

export async function updateCregisConnectionGates(params: {
  organizationId: string;
  executionEnabled?: boolean;
  environment?: 'sandbox' | 'production';
}): Promise<boolean> {
  const row = await prisma.treasury_integration_connections.findUnique({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: CREGIS_CONNECTION_PROVIDER,
      },
    },
    select: { metadata: true },
  });
  if (!row) return false;

  const metadata = {
    ...(asRecord(row.metadata) as CregisConnectionMetadata),
  };
  if (params.executionEnabled !== undefined) {
    metadata.executionEnabled = params.executionEnabled === true;
  }
  if (params.environment) {
    metadata.environment = params.environment;
  }

  await prisma.treasury_integration_connections.update({
    where: {
      ux_treasury_connections_org_provider: {
        organization_id: params.organizationId,
        provider: CREGIS_CONNECTION_PROVIDER,
      },
    },
    data: { metadata },
  });
  return true;
}

export async function getCregisConnectionStatus(organizationId: string): Promise<{
  connected: boolean;
  hasApiKey: boolean;
  gatewayConfigured: boolean;
  executionEnabled: boolean;
  connectionExecutionEnabled: boolean;
  selectable: boolean;
  environment: 'sandbox' | 'production' | null;
  pid: number | null;
  gatewayLooksProduction: boolean | null;
}> {
  const inspection = await inspectCregisConnection(organizationId);
  return {
    connected: inspection.connected,
    hasApiKey: inspection.hasApiKey,
    gatewayConfigured: inspection.hasGateway,
    executionEnabled: inspection.effectiveExecutionEnabled,
    connectionExecutionEnabled: inspection.connectionExecutionEnabled,
    selectable: isCregisConnectionSelectable(inspection, isCregisProductionExecutionEnabled()),
    environment: inspection.environment,
    pid: inspection.pid,
    gatewayLooksProduction: inspection.gatewayLooksProduction,
  };
}
