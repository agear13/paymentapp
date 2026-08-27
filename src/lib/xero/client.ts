/**
 * Xero OAuth Client
 * Handles OAuth 2.0 authentication flow with Xero API
 */

import { XeroClient } from 'xero-node';
import { loggers } from '@/lib/logger';
import {
  assertXeroConfigured,
  getMissingXeroEnvVars,
  XeroConfigurationError,
} from './xero-config';
import {
  assertConsentUrlStateMatches,
  assertOAuthStateMatchesCallbackUrl,
  traceOAuthState,
} from './oauth-state-trace';
import {
  logTokenSetTrace,
  tokenSetParametersFromApiCallback,
} from './token-set-trace';
import { applyConnectionToXeroClient } from './apply-connection-token-set';
import type { XeroOAuthTokenBundle } from './token-set-trace';
import { XeroRefreshError, xeroRefreshErrorFromUnknown } from './xero-refresh-errors';

/**
 * Check if Xero OAuth credentials are present (client id/secret/redirect).
 */
export function isXeroConfigured(): boolean {
  return getMissingXeroEnvVars().length === 0;
}

/**
 * Create a new Xero client instance.
 * `oauthState` must be set for OAuth authorize/callback (xero-node apiCallback checks.config.state).
 */
export function getXeroClient(oauthState?: string): XeroClient {
  loggers.xero.debug('xero_client_construct', {
    step: 'construct_xero_client',
    hasOAuthState: Boolean(oauthState),
  });
  assertXeroConfigured();

  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: [
      'offline_access',
      'accounting.transactions',
      'accounting.contacts',
      'accounting.settings.read',
    ],
    ...(oauthState ? { state: oauthState } : {}),
  });
}

export async function generateAuthUrl(oauthState: string): Promise<string> {
  if (!oauthState?.trim()) {
    throw new Error('OAuth state is required to build Xero consent URL');
  }

  traceOAuthState('generate_auth_url', oauthState);
  loggers.xero.info('xero_generate_auth_url', { step: 'generate_auth_url' });
  const client = getXeroClient(oauthState);
  const consentUrl = await client.buildConsentUrl();
  assertConsentUrlStateMatches(consentUrl, oauthState);
  return consentUrl;
}

/**
 * Exchange authorization code for access tokens.
 * `oauthState` must be the original state value returned by Xero on the callback URL.
 */
export async function exchangeCodeForTokens(
  callbackUrl: string,
  oauthState: string
): Promise<XeroOAuthTokenBundle> {
  if (!oauthState?.trim()) {
    throw new Error('OAuth state is required for Xero token exchange');
  }

  traceOAuthState('exchange_code_for_tokens', oauthState);
  assertOAuthStateMatchesCallbackUrl(callbackUrl, oauthState);

  loggers.xero.info('xero_exchange_code_start', { step: 'exchange_code_for_tokens' });

  try {
    loggers.xero.debug('xero_exchange_construct_client', { step: 'construct_xero_client' });
    const client = getXeroClient(oauthState);

    loggers.xero.info('xero_exchange_api_callback', { step: 'call_xero_token_api' });
    const tokenSet = await client.apiCallback(callbackUrl);

    logTokenSetTrace('api_callback_raw', tokenSet);

    const parsed = tokenSetParametersFromApiCallback(tokenSet);

    loggers.xero.info('xero_exchange_code_success', {
      step: 'exchange_code_for_tokens',
      expiresAt: parsed.expiresAt.toISOString(),
    });

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      idToken: parsed.idToken ?? null,
      scope: parsed.scope ?? null,
      tokenType: parsed.tokenType ?? null,
    };
  } catch (error) {
    loggers.xero.error('xero_exchange_code_failed', error, { step: 'exchange_code_for_tokens' });
    if (error instanceof XeroConfigurationError) {
      throw error;
    }
    throw error;
  }
}

function parseRefreshedTokenSet(
  tokenSet: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    token_type?: string;
    expires_at?: number;
    expires_in?: number;
  },
  previous: XeroOAuthTokenBundle
): XeroOAuthTokenBundle {
  if (!tokenSet.access_token) {
    throw new Error('TokenSet missing access_token');
  }

  let expiresAt: Date;
  if (tokenSet.expires_at != null) {
    expiresAt = new Date(Number(tokenSet.expires_at) * 1000);
  } else if (tokenSet.expires_in != null) {
    expiresAt = new Date(Date.now() + Number(tokenSet.expires_in) * 1000);
  } else {
    throw new Error('TokenSet missing expires_at and expires_in');
  }

  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token?.trim() || previous.refreshToken,
    expiresAt,
    idToken: tokenSet.id_token?.trim() ? tokenSet.id_token : previous.idToken ?? null,
    scope: tokenSet.scope?.trim() ? tokenSet.scope : previous.scope ?? null,
    tokenType: tokenSet.token_type?.trim() ? tokenSet.token_type : previous.tokenType ?? null,
  };
}

/**
 * Refresh a Xero access token. Pass the full persisted token bundle so openid-client
 * has access_token, scope, and token_type — not only the rotating refresh token.
 * If Xero omits a rotated refresh token, the previous refresh token is kept.
 */
export async function refreshAccessToken(
  tokens: XeroOAuthTokenBundle | string
): Promise<XeroOAuthTokenBundle> {
  const previous: XeroOAuthTokenBundle =
    typeof tokens === 'string'
      ? { accessToken: '', refreshToken: tokens, expiresAt: new Date(0) }
      : tokens;

  if (!previous.refreshToken) {
    throw new Error('Refresh token is required but was not provided');
  }

  loggers.xero.info('xero_token_refresh_attempted', {
    step: 'refresh_access_token',
    source: 'identity',
  });

  try {
    loggers.xero.debug('xero_refresh_construct_client', { step: 'construct_xero_client' });
    const client = getXeroClient();

    // xero-node 13.x refreshToken() calls this.openIdClient.refresh(...).
    // openIdClient is only assigned in initialize() (also used by buildConsentUrl /
    // apiCallback). A new client from getXeroClient() has openIdClient === undefined,
    // which produces: Cannot read properties of undefined (reading 'refresh').
    if (!client.openIdClient) {
      loggers.xero.debug('xero_refresh_initialize_openid', { step: 'initialize_openid_client' });
      await client.initialize();
    }
    if (!client.openIdClient || typeof client.openIdClient.refresh !== 'function') {
      throw new XeroRefreshError(
        'Xero OpenID client is not initialized; cannot refresh tokens',
        'internal'
      );
    }

    loggers.xero.debug('xero_refresh_set_token', { step: 'set_refresh_token' });
    await applyConnectionToXeroClient(
      client,
      {
        id: 'refresh',
        organizationId: 'refresh',
        tenantId: 'refresh',
        accessToken: previous.accessToken || previous.refreshToken,
        refreshToken: previous.refreshToken,
        expiresAt: previous.expiresAt,
        connectedAt: new Date(),
        tokenVersion: 0,
        idToken: previous.idToken,
        scope: previous.scope,
        tokenType: previous.tokenType,
      },
      'refresh_access_token'
    );

    loggers.xero.info('xero_refresh_call_api', { step: 'call_xero_refresh_api' });
    const tokenSet = await client.refreshToken();

    logTokenSetTrace('refresh_token_raw', tokenSet);

    const parsed = parseRefreshedTokenSet(tokenSet, previous);

    loggers.xero.info('xero_token_refresh_succeeded', {
      step: 'refresh_access_token',
      source: 'identity',
      expiresAt: parsed.expiresAt.toISOString(),
      rotatedRefreshToken: Boolean(tokenSet.refresh_token),
    });
    if (tokenSet.refresh_token) {
      loggers.xero.info('xero_refresh_token_rotated', {
        step: 'refresh_access_token',
        expiresAt: parsed.expiresAt.toISOString(),
      });
    }

    return parsed;
  } catch (error: unknown) {
    const classified = xeroRefreshErrorFromUnknown(error);
    loggers.xero.error('xero_token_refresh_failed', undefined, {
      step: 'refresh_access_token',
      source: 'identity',
      category: classified.category,
      statusCode: classified.statusCode ?? null,
      providerError: classified.providerError ?? null,
      message: classified.message,
    });
    throw classified;
  }
}

export async function getXeroTenants(tokens: XeroOAuthTokenBundle): Promise<Array<{
  tenantId: string;
  tenantName: string;
  tenantType: string;
}>> {
  loggers.xero.info('xero_get_tenants_start', { step: 'retrieve_tenant_list' });

  try {
    const client = getXeroClient();

    await applyConnectionToXeroClient(
      client,
      {
        id: 'oauth-flow',
        organizationId: 'oauth-flow',
        tenantId: 'pending',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        connectedAt: new Date(),
        tokenVersion: 0,
        idToken: tokens.idToken,
        scope: tokens.scope,
        tokenType: tokens.tokenType,
      },
      'get_tenants'
    );

    loggers.xero.debug('xero_update_tenants', { step: 'call_xero_connections_api' });
    const tenants = await client.updateTenants();

    loggers.xero.info('xero_get_tenants_success', {
      step: 'retrieve_tenant_list',
      tenantCount: tenants.length,
    });

    return tenants.map((tenant) => ({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName || 'Unknown Organization',
      tenantType: tenant.tenantType,
    }));
  } catch (error) {
    loggers.xero.error('xero_get_tenants_failed', error, { step: 'retrieve_tenant_list' });
    throw error;
  }
}

export async function revokeConnection(
  accessToken: string,
  tenantId?: string
): Promise<void> {
  const client = getXeroClient();

  await client.setTokenSet({
    access_token: accessToken,
  });

  if (tenantId) {
    await client.disconnect(tenantId);
  } else {
    const tenants = await client.updateTenants();
    for (const tenant of tenants) {
      await client.disconnect(tenant.tenantId);
    }
  }
}
