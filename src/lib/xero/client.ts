/**
 * Xero OAuth Client
 * Handles OAuth 2.0 authentication flow with Xero API
 */

import { XeroClient } from 'xero-node';

if (!process.env.XERO_CLIENT_ID) {
  throw new Error('Missing XERO_CLIENT_ID environment variable');
}

if (!process.env.XERO_CLIENT_SECRET) {
  throw new Error('Missing XERO_CLIENT_SECRET environment variable');
}

if (!process.env.XERO_REDIRECT_URI) {
  throw new Error('Missing XERO_REDIRECT_URI environment variable');
}

// Singleton instance
let xeroClient: XeroClient | null = null;

/**
 * Get or create Xero client instance
 */
export function getXeroClient(): XeroClient {
  if (!xeroClient) {
    xeroClient = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: [
        'offline_access', // For refresh tokens
        'accounting.transactions', // For invoices and payments
        'accounting.contacts.read', // For customer/contact management
        'accounting.settings.read', // For chart of accounts
      ],
    });
  }
  return xeroClient;
}

/**
 * Generate authorization URL for OAuth flow
 */
export function generateAuthUrl(): string {
  const client = getXeroClient();
  return client.buildConsentUrl();
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
  const client = getXeroClient();
  
  await client.setTokenSet({
    refresh_token: refreshToken,
  });

  const tokenSet = await client.refreshToken();

  if (!tokenSet.access_token || !tokenSet.refresh_token || !tokenSet.expires_in) {
    throw new Error('Invalid token response from Xero refresh');
  }

  const expiresAt = new Date(Date.now() + tokenSet.expires_in * 1000);

  return {
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    expiresAt,
  };
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
export async function revokeConnection(accessToken: string): Promise<void> {
  const client = getXeroClient();
  
  await client.setTokenSet({
    access_token: accessToken,
  });

  await client.disconnect();
}






