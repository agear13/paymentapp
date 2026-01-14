/**
 * Xero OAuth Client
 * Handles OAuth 2.0 authentication flow with Xero API
 */

import { XeroClient } from 'xero-node';

/**
 * Check if Xero is properly configured
 */
export function isXeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_REDIRECT_URI
  );
}

/**
 * Create a new Xero client instance
 * IMPORTANT: We create a new instance for each request to avoid token conflicts
 * in a multi-tenant environment. Each organization has different tokens,
 * so sharing a singleton would cause race conditions.
 * @throws Error if Xero credentials are not configured
 */
export function getXeroClient(): XeroClient {
  if (!isXeroConfigured()) {
    throw new Error(
      'Xero integration is not configured. Please set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI environment variables.'
    );
  }

  // Create a NEW instance for each request (not a singleton)
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: [
      'offline_access', // For refresh tokens
      'accounting.transactions', // For invoices and payments
      'accounting.contacts', // For customer/contact management (read + write)
      'accounting.settings.read', // For chart of accounts
    ],
  });
}

/**
 * Generate authorization URL for OAuth flow
 */
export async function generateAuthUrl(): Promise<string> {
  const client = getXeroClient();
  return await client.buildConsentUrl();
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const client = getXeroClient();
  
  const tokenSet = await client.apiCallback(process.env.XERO_REDIRECT_URI + `?code=${code}`);
  
  if (!tokenSet.access_token || !tokenSet.refresh_token || !tokenSet.expires_in) {
    throw new Error('Invalid token response from Xero');
  }

  const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000);

  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresAt,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  if (!refreshToken) {
    throw new Error('Refresh token is required but was not provided');
  }

  const client = getXeroClient();
  
  try {
    // Set the refresh token on the client
    await client.setTokenSet({
      refresh_token: refreshToken,
    });

    // Request a new access token
    const tokenSet = await client.refreshToken();

    if (!tokenSet.access_token || !tokenSet.refresh_token || !tokenSet.expires_in) {
      throw new Error('Invalid token response from Xero refresh: missing required fields');
    }

    const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000);

    return {
      accessToken: tokenSet.access_token,
      refreshToken: tokenSet.refresh_token,
      expiresAt,
    };
  } catch (error: any) {
    // Provide detailed error information for debugging
    const errorDetails = {
      message: error.message || 'Unknown error',
      status: error.response?.status,
      statusText: error.response?.statusText,
      body: error.response?.body,
    };
    
    console.error('Token refresh failed with details:', errorDetails);
    
    throw new Error(
      `Failed to refresh Xero token: ${errorDetails.message}. ` +
      `This usually means the connection has expired and needs to be re-authorized.`
    );
  }
}

/**
 * Get Xero tenants (organizations) available to the connected user
 */
export async function getXeroTenants(accessToken: string): Promise<Array<{
  tenantId: string;
  tenantName: string;
  tenantType: string;
}>> {
  const client = getXeroClient();
  
  await client.setTokenSet({
    access_token: accessToken,
  });

  const tenants = await client.updateTenants();

  return tenants.map((tenant) => ({
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || 'Unknown Organization',
    tenantType: tenant.tenantType,
  }));
}

/**
 * Revoke Xero connection (disconnect)
 */
export async function revokeConnection(
  accessToken: string,
  tenantId?: string
): Promise<void> {
  const client = getXeroClient();
  
  await client.setTokenSet({
    access_token: accessToken,
  });

  // Disconnect from specific tenant if provided, otherwise all tenants
  if (tenantId) {
    await client.disconnect(tenantId);
  } else {
    // When no tenant specified, get all tenants and disconnect from each
    const tenants = await client.updateTenants();
    for (const tenant of tenants) {
      await client.disconnect(tenant.tenantId);
    }
  }
}






