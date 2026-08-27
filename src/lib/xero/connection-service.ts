/**
 * Xero Connection Service
 * Manages Xero OAuth connections, token storage, and refresh
 */

import { prisma } from '@/lib/server/prisma';
import { encryptToken, decryptToken } from './encryption';
import { refreshAccessToken, getXeroTenants, revokeConnection } from './client';
import { randomUUID } from 'crypto';
import { loggers } from '@/lib/logger';
import {
  compareTokenSetTrace,
  logTokenSetTrace,
  buildTokenSetParameters,
  isLegacyIncompleteXeroConnectionRow,
  XERO_OAUTH_SCOPES_PERSISTED,
  type XeroOAuthTokenBundle,
} from './token-set-trace';
import {
  classifyXeroRefreshFailure,
  isRetryableXeroRefreshCategory,
  toXeroRefreshFailureDiagnostics,
  XeroRefreshError,
  type XeroRefreshFailureDiagnostics,
} from './xero-refresh-errors';
import { computeXeroConnectionState, type XeroConnectionState } from './xero-connection-state';

export interface XeroConnection {
  id: string;
  organizationId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  connectedAt: Date;
  tokenVersion: number;
  lastRefreshAt?: Date | null;
  idToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
}

type XeroConnectionRow = {
  id: string;
  organization_id: string;
  tenant_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  connected_at: Date;
  id_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  token_version?: number | null;
  last_refresh_at?: Date | null;
};

export type { XeroOAuthTokenBundle } from './token-set-trace';

function mapRowToConnection(
  connection: XeroConnectionRow,
  accessToken: string,
  refreshToken: string,
  idToken?: string | null
): XeroConnection {
  return {
    id: connection.id,
    organizationId: connection.organization_id,
    tenantId: connection.tenant_id,
    accessToken,
    refreshToken,
    expiresAt: connection.expires_at,
    connectedAt: connection.connected_at,
    tokenVersion: connection.token_version ?? 0,
    lastRefreshAt: connection.last_refresh_at ?? null,
    idToken: idToken ?? null,
    tokenType: connection.token_type ?? null,
    scope: connection.scope ?? null,
  };
}

/**
 * Store new Xero connection
 */
export async function storeXeroConnection(
  organizationId: string,
  tenantId: string,
  tokens: XeroOAuthTokenBundle
): Promise<XeroConnection> {
  const { accessToken, refreshToken, expiresAt, idToken, scope, tokenType } = tokens;
  const persistedScope = scope?.trim() || XERO_OAUTH_SCOPES_PERSISTED;
  const persistedTokenType = tokenType?.trim() || 'Bearer';

  loggers.xero.info('xero_store_connection_start', {
    step: 'persist_connection',
    organizationId,
    tenantId,
    expiresAt: expiresAt.toISOString(),
  });

  logTokenSetTrace('store_connection_plaintext', {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    id_token: idToken ?? undefined,
    scope: persistedScope,
    token_type: persistedTokenType,
  });

  loggers.xero.debug('xero_store_encrypt_tokens', {
    step: 'encrypt_tokens',
    organizationId,
  });
  const encryptedAccessToken = encryptToken(accessToken);
  const encryptedRefreshToken = encryptToken(refreshToken);
  const encryptedIdToken = idToken ? encryptToken(idToken) : null;

  const connection = await prisma.xero_connections.upsert({
    where: { organization_id: organizationId },
    create: {
      id: randomUUID(),
      organization_id: organizationId,
      tenant_id: tenantId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      id_token: encryptedIdToken,
      token_type: persistedTokenType,
      scope: persistedScope,
      expires_at: expiresAt,
      token_version: 0,
    },
    update: {
      tenant_id: tenantId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      id_token: encryptedIdToken,
      token_type: persistedTokenType,
      scope: persistedScope,
      expires_at: expiresAt,
      token_version: { increment: 1 },
    },
  });

  const decryptedAccess = decryptToken(connection.access_token);
  const decryptedRefresh = decryptToken(connection.refresh_token);
  const decryptedIdToken = connection.id_token ? decryptToken(connection.id_token) : null;

  logTokenSetTrace('store_connection_decrypted_from_db', {
    access_token: decryptedAccess,
    refresh_token: decryptedRefresh,
    expires_at: Math.floor(connection.expires_at.getTime() / 1000),
    id_token: decryptedIdToken ?? undefined,
    scope: connection.scope ?? undefined,
    token_type: connection.token_type ?? undefined,
  });

  compareTokenSetTrace('store_connection_round_trip', buildTokenSetParameters({
    accessToken,
    refreshToken,
    expiresAt,
    idToken,
    scope: persistedScope,
    tokenType: persistedTokenType,
  }), buildTokenSetParameters({
    accessToken: decryptedAccess,
    refreshToken: decryptedRefresh,
    expiresAt: connection.expires_at,
    idToken: decryptedIdToken,
    scope: connection.scope,
    tokenType: connection.token_type,
  }));

    loggers.xero.info('xero_authorization_completed', {
      step: 'persist_connection',
      organizationId,
      tenantId,
      connectionId: connection.id,
      expiresAt: connection.expires_at.toISOString(),
    });

  return mapRowToConnection(
    connection,
    decryptedAccess,
    decryptedRefresh,
    decryptedIdToken
  );
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

  if (isLegacyIncompleteXeroConnectionRow(connection)) {
    loggers.xero.warn('xero_connection_legacy_incomplete', {
      step: 'load_xero_connection',
      organizationId,
      tenantId: connection.tenant_id,
      message:
        'Connection predates token metadata migration — re-authorize Xero instead of refreshing',
    });
    return null;
  }

  try {
    loggers.xero.debug('xero_get_connection_decrypt', {
      step: 'decrypt_tokens',
      organizationId,
      tenantId: connection.tenant_id,
    });

    const decryptedAccess = decryptToken(connection.access_token);
    const decryptedRefresh = decryptToken(connection.refresh_token);
    const decryptedIdToken = connection.id_token ? decryptToken(connection.id_token) : null;

    logTokenSetTrace('get_connection_decrypted', {
      access_token: decryptedAccess,
      refresh_token: decryptedRefresh,
      expires_at: Math.floor(connection.expires_at.getTime() / 1000),
      id_token: decryptedIdToken ?? undefined,
      scope: connection.scope ?? undefined,
      token_type: connection.token_type ?? undefined,
    });

    const result = mapRowToConnection(
      connection,
      decryptedAccess,
      decryptedRefresh,
      decryptedIdToken
    );

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

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const organizationTokenRefreshLocks = new Map<string, Promise<unknown>>();

async function withOrganizationTokenRefreshLock<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  const previous = organizationTokenRefreshLocks.get(organizationId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = previous.catch(() => undefined).then(() => gate);
  organizationTokenRefreshLocks.set(organizationId, held);
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (organizationTokenRefreshLocks.get(organizationId) === held) {
      organizationTokenRefreshLocks.delete(organizationId);
    }
  }
}

function mergeRefreshedTokens(
  previous: XeroConnection,
  refreshed: XeroOAuthTokenBundle
): XeroOAuthTokenBundle {
  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken?.trim() || previous.refreshToken,
    expiresAt: refreshed.expiresAt,
    idToken: refreshed.idToken?.trim() ? refreshed.idToken : previous.idToken,
    scope: refreshed.scope?.trim() ? refreshed.scope : previous.scope,
    tokenType: refreshed.tokenType?.trim() ? refreshed.tokenType : previous.tokenType,
  };
}

async function persistRotatedConnection(
  previous: XeroConnection,
  refreshed: XeroOAuthTokenBundle
): Promise<XeroConnection> {
  const merged = mergeRefreshedTokens(previous, refreshed);
  const encryptedAccessToken = encryptToken(merged.accessToken);
  const encryptedRefreshToken = encryptToken(merged.refreshToken);
  const encryptedIdToken = merged.idToken ? encryptToken(merged.idToken) : null;
  const refreshAttemptedAt = new Date();

  try {
    const result = await prisma.xero_connections.updateMany({
      where: {
        organization_id: previous.organizationId,
        token_version: previous.tokenVersion,
      },
      data: {
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        id_token: encryptedIdToken,
        token_type: merged.tokenType?.trim() || previous.tokenType,
        scope: merged.scope?.trim() || previous.scope,
        expires_at: merged.expiresAt,
        token_version: { increment: 1 },
        last_refresh_at: refreshAttemptedAt,
      },
    });

    if (result.count !== 1) {
      loggers.xero.warn('xero_refresh_cas_miss', {
        organizationId: previous.organizationId,
        connectionId: previous.id,
        tenantId: previous.tenantId,
        expectedTokenVersion: previous.tokenVersion,
        refreshAttemptedAt: refreshAttemptedAt.toISOString(),
      });
      const current = await getXeroConnection(previous.organizationId);
      if (current && current.tokenVersion !== previous.tokenVersion) {
        return current;
      }
      throw new XeroRefreshError(
        'Xero credentials were updated by another request and could not be reloaded',
        'persist_failed'
      );
    }
  } catch (error) {
    if (error instanceof XeroRefreshError) throw error;
    loggers.xero.error('xero_credential_persistence_failed', error, {
      organizationId: previous.organizationId,
      connectionId: previous.id,
      tenantId: previous.tenantId,
      tokenVersion: previous.tokenVersion,
      expiresAt: previous.expiresAt.toISOString(),
      refreshAttemptedAt: refreshAttemptedAt.toISOString(),
    });
    throw new XeroRefreshError(
      'Failed to persist rotated Xero credentials',
      'persist_failed'
    );
  }

  const stored = await getXeroConnection(previous.organizationId);
  if (!stored) {
    throw new XeroRefreshError(
      'Rotated Xero credentials could not be reloaded after persist',
      'persist_failed'
    );
  }

  loggers.xero.info('xero_refresh_token_rotated', {
    organizationId: stored.organizationId,
    connectionId: stored.id,
    tenantId: stored.tenantId,
    tokenVersion: stored.tokenVersion,
    expiresAt: stored.expiresAt.toISOString(),
    refreshAttemptedAt: refreshAttemptedAt.toISOString(),
  });

  return stored;
}

async function refreshPersistedConnection(
  connection: XeroConnection
): Promise<XeroConnection> {
  const refreshed = await refreshAccessToken({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    idToken: connection.idToken,
    scope: connection.scope,
    tokenType: connection.tokenType,
  });

  return persistRotatedConnection(connection, refreshed);
}

/**
 * Get valid access token (refreshing if necessary)
 */
export async function getValidAccessToken(
  organizationId: string
): Promise<string | null> {
  const connection = await getActiveConnection(organizationId);
  return connection?.accessToken ?? null;
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
 * Disconnect Xero connection.
 * Local row deletion is the source of truth. Xero-side revoke is best-effort
 * so a failed remote revocation cannot leave the workspace stuck connected.
 */
export async function disconnectXero(
  organizationId: string
): Promise<void> {
  const row = await getXeroConnectionRow(organizationId);
  if (!row) {
    return;
  }

  const connection = await getXeroConnection(organizationId);
  if (connection) {
    try {
      await revokeConnection(connection.accessToken);
    } catch (error) {
      loggers.xero.error('xero_revoke_failed', error, {
        step: 'revoke_connection',
        organizationId,
      });
    }
  }

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
  const connection = await getActiveConnection(organizationId);

  if (!connection) {
    return null;
  }

  return getXeroTenants({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt,
    idToken: connection.idToken,
    scope: connection.scope,
    tokenType: connection.tokenType,
  });
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

export type XeroActiveConnectionLoad = {
  connection: XeroConnection | null;
  persisted: boolean;
  reauthorizationRequired: boolean;
  transientRefreshFailure: boolean;
  internalFailure: boolean;
  refreshFailure?: XeroRefreshFailureDiagnostics | null;
};

function emptyActiveLoad(
  persisted: boolean,
  extra?: Partial<XeroActiveConnectionLoad>
): XeroActiveConnectionLoad {
  return {
    connection: null,
    persisted,
    reauthorizationRequired: false,
    transientRefreshFailure: false,
    internalFailure: false,
    refreshFailure: extra?.refreshFailure ?? null,
    ...extra,
  };
}

function logXeroTokenRefreshFailed(
  connection: XeroConnection,
  refreshFailure: XeroRefreshFailureDiagnostics
): void {
  loggers.xero.error('xero_token_refresh_failed', undefined, {
    step: 'refresh_access_token',
    source: 'connection_service',
    organizationId: connection.organizationId,
    tenantId: connection.tenantId,
    connectionId: connection.id,
    category: refreshFailure.category,
    statusCode: refreshFailure.statusCode,
    providerError: refreshFailure.providerError,
    message: refreshFailure.message,
    expiresAt: connection.expiresAt.toISOString(),
    tokenVersion: connection.tokenVersion,
  });
}

/**
 * Get active Xero connection with valid token.
 * Concurrent callers for the same organization share one refresh so Xero's
 * rotating refresh token is not invalidated by a parallel invalid_grant.
 */
export async function getActiveConnection(
  organizationId: string
): Promise<XeroConnection | null> {
  const loaded = await loadActiveXeroConnection(organizationId);
  return loaded.connection;
}

export async function loadActiveXeroConnection(
  organizationId: string
): Promise<XeroActiveConnectionLoad> {
  return withOrganizationTokenRefreshLock(organizationId, async () => {
    loggers.xero.debug('xero_get_active_connection_start', {
      step: 'get_active_connection',
      organizationId,
    });

    const row = await getXeroConnectionRow(organizationId);
    if (!row) {
      loggers.xero.debug('xero_get_active_connection_none', {
        step: 'get_active_connection',
        organizationId,
      });
      return emptyActiveLoad(false);
    }

    const connection = await getXeroConnection(organizationId);
    if (!connection) {
      return emptyActiveLoad(true, { reauthorizationRequired: true });
    }

    const isExpired =
      connection.expiresAt.getTime() - Date.now() < ACCESS_TOKEN_EXPIRY_BUFFER_MS;

    if (!isExpired) {
      loggers.xero.debug('xero_get_active_connection_valid', {
        step: 'get_active_connection',
        organizationId,
        tenantId: connection.tenantId,
        connectionId: connection.id,
      });
      return {
        connection,
        persisted: true,
        reauthorizationRequired: false,
        transientRefreshFailure: false,
        internalFailure: false,
        refreshFailure: null,
      };
    }

    loggers.xero.info('xero_token_refresh_attempted', {
      step: 'refresh_access_token',
      source: 'connection_service',
      organizationId,
      tenantId: connection.tenantId,
      connectionId: connection.id,
      expiresAt: connection.expiresAt.toISOString(),
      tokenVersion: connection.tokenVersion,
    });

    try {
      const stored = await refreshPersistedConnection(connection);

      loggers.xero.info('xero_token_refresh_succeeded', {
        step: 'refresh_access_token',
        source: 'connection_service',
        organizationId,
        tenantId: stored.tenantId,
        connectionId: stored.id,
        expiresAt: stored.expiresAt.toISOString(),
        tokenVersion: stored.tokenVersion,
      });

      return {
        connection: stored,
        persisted: true,
        reauthorizationRequired: false,
        transientRefreshFailure: false,
        internalFailure: false,
        refreshFailure: null,
      };
    } catch (error: unknown) {
      const classified = classifyXeroRefreshFailure(error);
      const refreshFailure = toXeroRefreshFailureDiagnostics(classified);
      logXeroTokenRefreshFailed(connection, refreshFailure);

      if (classified.category === 'invalid_grant') {
        const reloaded = await getXeroConnection(organizationId);
        if (
          reloaded &&
          reloaded.tokenVersion !== connection.tokenVersion &&
          reloaded.expiresAt.getTime() - Date.now() >= ACCESS_TOKEN_EXPIRY_BUFFER_MS
        ) {
          loggers.xero.info('xero_refresh_invalid_grant_recovered', {
            organizationId,
            connectionId: reloaded.id,
            tenantId: reloaded.tenantId,
            tokenVersion: reloaded.tokenVersion,
          });
          return {
            connection: reloaded,
            persisted: true,
            reauthorizationRequired: false,
            transientRefreshFailure: false,
            internalFailure: false,
            refreshFailure: null,
          };
        }

        loggers.xero.warn('xero_reauthorization_required', {
          organizationId,
          connectionId: connection.id,
          tenantId: connection.tenantId,
          category: classified.category,
          statusCode: classified.statusCode ?? null,
          providerError: classified.providerError ?? null,
          message: refreshFailure.message,
          expiresAt: connection.expiresAt.toISOString(),
        });
        return emptyActiveLoad(true, {
          reauthorizationRequired: true,
          refreshFailure,
        });
      }

      if (connection.expiresAt.getTime() > Date.now()) {
        loggers.xero.warn('xero_get_active_connection_stale_fallback', {
          step: 'refresh_access_token',
          organizationId,
          tenantId: connection.tenantId,
          connectionId: connection.id,
          category: classified.category,
          statusCode: classified.statusCode ?? null,
          providerError: classified.providerError ?? null,
        });
        return {
          connection,
          persisted: true,
          reauthorizationRequired: false,
          transientRefreshFailure:
            isRetryableXeroRefreshCategory(classified.category) ||
            classified.category === 'unclassified',
          internalFailure: classified.category === 'internal',
          refreshFailure,
        };
      }

      return emptyActiveLoad(true, {
        transientRefreshFailure:
          isRetryableXeroRefreshCategory(classified.category) ||
          classified.category === 'unclassified',
        reauthorizationRequired: classified.category === 'persist_failed',
        internalFailure: classified.category === 'internal',
        refreshFailure,
      });
    }
  });
}

/**
 * Resolve connection for API routes — distinguishes missing vs stale persistence.
 */
export async function resolveXeroConnectionForApi(organizationId: string): Promise<{
  connection: XeroConnection | null;
  persisted: boolean;
  stale: boolean;
  reauthorizationRequired: boolean;
  transientRefreshFailure: boolean;
  internalFailure: boolean;
}> {
  const loaded = await loadActiveXeroConnection(organizationId);
  return {
    connection: loaded.connection,
    persisted: loaded.persisted,
    stale: loaded.reauthorizationRequired,
    reauthorizationRequired: loaded.reauthorizationRequired,
    transientRefreshFailure: loaded.transientRefreshFailure,
    internalFailure: loaded.internalFailure,
  };
}

export type XeroConnectionStatus = {
  connected: boolean;
  stale?: boolean;
  reauthorizationRequired?: boolean;
  transientRefreshFailure?: boolean;
  internalFailure?: boolean;
  refreshFailure?: XeroRefreshFailureDiagnostics | null;
  connectionState: XeroConnectionState;
  tenantId?: string;
  expiresAt?: Date;
  connectedAt?: Date;
};

/**
 * Get connection status for organization.
 * `connected` means a decryptable Xero connection row exists for this org —
 * not that the short-lived access token is currently usable. Expired access
 * tokens are refreshed separately; a genuine invalid refresh token is `stale`
 * / AUTH_REAUTH_REQUIRED. Transient refresh failures are not treated as
 * disconnected or as a required reconnect.
 */
export async function getConnectionStatus(
  organizationId: string
): Promise<XeroConnectionStatus> {
  const row = await getXeroConnectionRow(organizationId);

  if (!row) {
    return { connected: false, connectionState: 'DISCONNECTED' };
  }

  if (isLegacyIncompleteXeroConnectionRow(row)) {
    return {
      connected: false,
      tenantId: row.tenant_id,
      expiresAt: row.expires_at,
      connectedAt: row.connected_at,
      connectionState: 'CONNECTED_UNVERIFIED',
      reauthorizationRequired: true,
    };
  }

  const connection = await getXeroConnection(organizationId);

  if (!connection) {
    return {
      connected: false,
      tenantId: row.tenant_id,
      expiresAt: row.expires_at,
      connectedAt: row.connected_at,
      connectionState: 'CONNECTED_UNVERIFIED',
      reauthorizationRequired: true,
    };
  }

  const loaded = await loadActiveXeroConnection(organizationId);
  const tenantId = loaded.connection?.tenantId ?? connection.tenantId;
  const status: XeroConnectionStatus = {
    connected: true,
    tenantId,
    expiresAt: loaded.connection?.expiresAt ?? connection.expiresAt,
    connectedAt: loaded.connection?.connectedAt ?? connection.connectedAt,
    connectionState: computeXeroConnectionState({
      connected: true,
      stale: loaded.reauthorizationRequired,
      reauthorizationRequired: loaded.reauthorizationRequired,
      transientRefreshFailure: loaded.transientRefreshFailure && !loaded.connection,
      internalFailure: loaded.internalFailure && !loaded.connection,
      tenantId,
    }),
  };

  if (loaded.reauthorizationRequired) {
    status.stale = true;
    status.reauthorizationRequired = true;
  }
  if (loaded.transientRefreshFailure && !loaded.connection) {
    status.transientRefreshFailure = true;
  }
  if (loaded.internalFailure && !loaded.connection) {
    status.internalFailure = true;
  }
  if (loaded.refreshFailure) {
    status.refreshFailure = loaded.refreshFailure;
  }

  return status;
}






