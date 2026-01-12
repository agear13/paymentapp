/**
 * Xero Connection Service
 * Manages Xero OAuth connections, token storage, and refresh
 */

import { prisma } from '@/lib/server/prisma';
import { encryptToken, decryptToken } from './encryption';
import { refreshAccessToken, getXeroTenants, revokeConnection } from './client';
import { randomUUID } from 'crypto';

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
 * Get Xero connection for an organization
 */
export async function getXeroConnection(
  organizationId: string
): Promise<XeroConnection | null> {
  const connection = await prisma.xero_connections.findUnique({
    where: { organization_id: organizationId },
  });

  if (!connection) {
    return null;
  }

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

  // Token is expired, refresh it
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
    console.error('Failed to refresh Xero token:', error);
    // Token refresh failed, connection is invalid
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
    // Revoke token with Xero
    await revokeConnection(connection.accessToken);
  } catch (error) {
    console.error('Failed to revoke Xero connection:', error);
    // Continue with local deletion even if revoke fails
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
  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    return null;
  }

  // Check if token is expired or will expire in the next 5 minutes
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired = connection.expiresAt.getTime() - Date.now() < expiryBuffer;

  if (!isExpired) {
    return connection;
  }

  // Token is expired, refresh it
  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    
    return await storeXeroConnection(
      organizationId,
      connection.tenantId,
      refreshed.accessToken,
      refreshed.refreshToken,
      refreshed.expiresAt
    );
  } catch (error: any) {
    console.error('Failed to refresh Xero token:', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      body: error.response?.body,
      organizationId,
      tenantId: connection.tenantId,
    });
    return null;
  }
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






