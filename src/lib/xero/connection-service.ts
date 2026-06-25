/**
 * Xero Connection Service
 * Manages Xero OAuth connections, token storage, and refresh
 */

import { prisma } from '@/lib/server/prisma';
import { encryptToken, decryptToken } from './encryption';
import { refreshAccessToken, getXeroTenants, revokeConnection } from './client';
import { randomUUID } from 'crypto';
import { loggers } from '@/lib/logger';

export interface XeroConnection {
  id: string;
  organizationId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  connectedAt: Date;
}

/**
 * Store new Xero connection
 */
export async function storeXeroConnection(
  organizationId: string,
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<XeroConnection> {
  loggers.xero.info('xero_store_connection_start', {
    step: 'persist_connection',
    organizationId,
    tenantId,
    expiresAt: expiresAt.toISOString(),
  });

  loggers.xero.debug('xero_store_encrypt_tokens', {
    step: 'encrypt_tokens',
    organizationId,
  });
  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken = encryptToken(refreshToken);

  const connection = await prisma.xero_connections.upsert({
    where: { organization_id: organizationId },
    create: {
      id: randomUUID(),
      organization_id: organizationId,
      tenant_id: tenantId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt,
    },
    update: {
      tenant_id: tenantId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt,
    },
  });

  loggers.xero.info('xero_store_connection_success', {
    step: 'persist_connection',
    organizationId,
    tenantId,
  });

  return {
    id: connection.id,
    organizationId: connection.organization_id,
    tenantId: connection.tenant_id,
    accessToken: decryptToken(connection.access_token),
    refreshToken: decryptToken(connection.refresh_token),
    expiresAt: connection.expires_at,
    connectedAt: connection.connected_at,
  };
}

/**
 * Get raw persisted connection row (no token decryption).
 */
export async function getXeroConnectionRow(organizationId: string) {
  return prisma.xero_connections.findUnique({
    where: { organization_id: organizationId },
  });
}

/**
 * Get Xero connection for an organization
 */
export async function getXeroConnection(
  organizationId: string
): Promise<XeroConnection | null> {
  loggers.xero.debug('xero_get_connection_start', {
    step: 'load_xero_connection',
    organizationId,
  });

  const connection = await prisma.xero_connections.findUnique({
    where: { organization_id: organizationId },
  });

  if (!connection) {
    loggers.xero.debug('xero_get_connection_not_found', {
      step: 'load_xero_connection',
      organizationId,
    });
    return null;
  }

  try {
    loggers.xero.debug('xero_get_connection_decrypt', {
      step: 'decrypt_tokens',
      organizationId,
      tenantId: connection.tenant_id,
    });

    const result = {
      id: connection.id,
      organizationId: connection.organization_id,
      tenantId: connection.tenant_id,
      accessToken: decryptToken(connection.access_token),
      refreshToken: decryptToken(connection.refresh_token),
      expiresAt: connection.expires_at,
      connectedAt: connection.connected_at,
    };

    loggers.xero.debug('xero_get_connection_success', {
      step: 'load_xero_connection',
      organizationId,
      tenantId: result.tenantId,
      expiresAt: result.expiresAt.toISOString(),
    });

    return result;
  } catch (error) {
    loggers.xero.error('xero_get_connection_decrypt_failed', error, {
      step: 'decrypt_tokens',
      organizationId,
      tenantId: connection.tenant_id,
    });
    return null;
  }
}

/**
 * Get valid access token (refreshing if necessary)
 */
export async function getValidAccessToken(
  organizationId: string
): Promise<string | null> {
  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    return null;
  }

  // Check if token is expired or will expire in the next 5 minutes
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired = connection.expiresAt.getTime() - Date.now() < expiryBuffer;

  if (!isExpired) {
    return connection.accessToken;
  }

  loggers.xero.info('xero_get_valid_token_refresh', {
    step: 'refresh_access_token',
    organizationId,
    tenantId: connection.tenantId,
    expiresAt: connection.expiresAt.toISOString(),
  });

  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);

    await storeXeroConnection(
      organizationId,
      connection.tenantId,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresAt
    );

    return refreshed.accessToken;
  } catch (error) {
    loggers.xero.error('xero_get_valid_token_refresh_failed', error, {
      step: 'refresh_access_token',
      organizationId,
      tenantId: connection.tenantId,
    });
    return null;
  }
}

/**
 * Check if organization has a valid Xero connection
 */
export async function hasValidConnection(
  organizationId: string
): Promise<boolean> {
  const token = await getValidAccessToken(organizationId);
  return token !== null;
}

/**
 * Disconnect Xero connection
 */
export async function disconnectXero(
  organizationId: string
): Promise<void> {
  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    return;
  }

  try {
    await revokeConnection(connection.accessToken);
  } catch (error) {
    loggers.xero.error('xero_revoke_failed', error, {
      step: 'revoke_connection',
      organizationId,
    });
  }

  // Delete connection from database
  await prisma.xero_connections.delete({
    where: { organization_id: organizationId },
  });
}

/**
 * Get available Xero tenants for a connection
 */
export async function getAvailableTenants(
  organizationId: string
): Promise<Array<{
  tenantId: string;
  tenantName: string;
  tenantType: string;
}> | null> {
  const accessToken = await getValidAccessToken(organizationId);

  if (!accessToken) {
    return null;
  }

  return getXeroTenants(accessToken);
}

/**
 * Update selected tenant for organization
 */
export async function updateSelectedTenant(
  organizationId: string,
  tenantId: string
): Promise<void> {
  await prisma.xero_connections.update({
    where: { organization_id: organizationId },
    data: { tenant_id: tenantId },
  });
}

/**
 * Get active Xero connection with valid token
 * Returns null if no connection or token is invalid
 */
export async function getActiveConnection(
  organizationId: string
): Promise<XeroConnection | null> {
  loggers.xero.debug('xero_get_active_connection_start', {
    step: 'get_active_connection',
    organizationId,
  });

  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    loggers.xero.debug('xero_get_active_connection_none', {
      step: 'get_active_connection',
      organizationId,
    });
    return null;
  }

  const expiryBuffer = 5 * 60 * 1000;
  const isExpired = connection.expiresAt.getTime() - Date.now() < expiryBuffer;

  if (!isExpired) {
    loggers.xero.debug('xero_get_active_connection_valid', {
      step: 'get_active_connection',
      organizationId,
      tenantId: connection.tenantId,
    });
    return connection;
  }

  loggers.xero.info('xero_get_active_connection_refresh', {
    step: 'refresh_access_token',
    organizationId,
    tenantId: connection.tenantId,
    expiresAt: connection.expiresAt.toISOString(),
  });

  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);

    const stored = await storeXeroConnection(
      organizationId,
      connection.tenantId,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresAt
    );

    loggers.xero.info('xero_get_active_connection_refreshed', {
      step: 'refresh_access_token',
      organizationId,
      tenantId: stored.tenantId,
    });

    return stored;
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      response?: { status?: number; statusText?: string; body?: unknown };
    };
    loggers.xero.error('xero_get_active_connection_refresh_failed', error, {
      step: 'refresh_access_token',
      organizationId,
      tenantId: connection.tenantId,
      status: err.response?.status,
      statusText: err.response?.statusText,
    });

    if (connection.expiresAt.getTime() > Date.now()) {
      loggers.xero.warn('xero_get_active_connection_stale_fallback', {
        step: 'refresh_access_token',
        organizationId,
        tenantId: connection.tenantId,
      });
      return connection;
    }
    return null;
  }
}

/**
 * Resolve connection for API routes — distinguishes missing vs stale persistence.
 */
export async function resolveXeroConnectionForApi(organizationId: string): Promise<{
  connection: XeroConnection | null;
  persisted: boolean;
  stale: boolean;
}> {
  const row = await getXeroConnectionRow(organizationId);
  if (!row) {
    return { connection: null, persisted: false, stale: false };
  }

  const connection = await getActiveConnection(organizationId);
  if (connection) {
    return { connection, persisted: true, stale: false };
  }

  return { connection: null, persisted: true, stale: true };
}

/**
 * Get connection status for organization
 */
export async function getConnectionStatus(
  organizationId: string
): Promise<{
  connected: boolean;
  tenantId?: string;
  expiresAt?: Date;
  connectedAt?: Date;
}> {
  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    return { connected: false };
  }

  const isValid = await hasValidConnection(organizationId);

  return {
    connected: isValid,
    tenantId: connection.tenantId,
    expiresAt: connection.expiresAt,
    connectedAt: connection.connectedAt,
  };
}






