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

/**
 * Check if Xero OAuth credentials are present (client id/secret/redirect).
 */
export function isXeroConfigured(): boolean {
  return getMissingXeroEnvVars().length === 0;
}

/**
 * Create a new Xero client instance
 */
export function getXeroClient(): XeroClient {
  loggers.xero.debug('xero_client_construct', { step: 'construct_xero_client' });
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
  });
}

export async function generateAuthUrl(): Promise<string> {
  loggers.xero.info('xero_generate_auth_url', { step: 'generate_auth_url' });
  const client = getXeroClient();
  return await client.buildConsentUrl();
}

/**
 * Exchange authorization code for access tokens.
 */
export async function exchangeCodeForTokens(callbackUrl: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  loggers.xero.info('xero_exchange_code_start', { step: 'exchange_code_for_tokens' });

  try {
    loggers.xero.debug('xero_exchange_construct_client', { step: 'construct_xero_client' });
    const client = getXeroClient();

    loggers.xero.info('xero_exchange_api_callback', { step: 'call_xero_token_api' });
    const tokenSet = await client.apiCallback(callbackUrl);

    if (!tokenSet.access_token || !tokenSet.refresh_token || !tokenSet.expires_in) {
      throw new Error('Invalid token response from Xero');
    }

    const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000);

    loggers.xero.info('xero_exchange_code_success', {
      step: 'exchange_code_for_tokens',
      expiresAt: expiresAt.toISOString(),
    });

    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt,
    };
  } catch (error) {
    loggers.xero.error('xero_exchange_code_failed', error, { step: 'exchange_code_for_tokens' });
    if (error instanceof XeroConfigurationError) {
      throw error;
    }
    throw error;
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  if (!refreshToken) {
    throw new Error('Refresh token is required but was not provided');
  }

  loggers.xero.info('xero_refresh_token_start', { step: 'refresh_access_token' });

  try {
    loggers.xero.debug('xero_refresh_construct_client', { step: 'construct_xero_client' });
    const client = getXeroClient();

    loggers.xero.debug('xero_refresh_set_token', { step: 'set_refresh_token' });
    await client.setTokenSet({
      refresh_token: refreshToken,
    });

    loggers.xero.info('xero_refresh_call_api', { step: 'call_xero_refresh_api' });
    const tokenSet = await client.refreshToken();

    if (!tokenSet.access_token || !tokenSet.refresh_token || !tokenSet.expires_in) {
      throw new Error('Invalid token response from Xero refresh: missing required fields');
    }

    const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000);

    loggers.xero.info('xero_refresh_token_success', {
      step: 'refresh_access_token',
      expiresAt: expiresAt.toISOString(),
    });

    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt,
    };
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      response?: { status?: number; statusText?: string; body?: unknown };
    };
    loggers.xero.error('xero_refresh_token_failed', error, {
      step: 'refresh_access_token',
      status: err.response?.status,
      statusText: err.response?.statusText,
    });

    throw new Error(
      `Failed to refresh Xero token: ${err.message ?? 'Unknown error'}. ` +
        'This usually means the connection has expired and needs to be re-authorized.'
    );
  }
}

export async function getXeroTenants(accessToken: string): Promise<Array<{
  tenantId: string;
  tenantName: string;
  tenantType: string;
}>> {
  loggers.xero.info('xero_get_tenants_start', { step: 'retrieve_tenant_list' });

  try {
    const client = getXeroClient();

    await client.setTokenSet({
      access_token: accessToken,
    });

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
