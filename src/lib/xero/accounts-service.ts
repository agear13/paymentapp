/**
 * Xero Accounts Service
 * Manages fetching and querying Xero Chart of Accounts
 */

import { getXeroClient } from './client';
import { getActiveConnection } from './connection-service';

export interface XeroAccount {
  accountID: string;
  code: string;
  name: string;
  type: string;
  taxType?: string;
  status: string;
  class?: string;
}

export interface AccountsResponse {
  accounts: XeroAccount[];
  total: number;
}

/**
 * Fetch chart of accounts from Xero
 */
export async function fetchXeroAccounts(
  organizationId: string
): Promise<AccountsResponse> {
  // Get active Xero connection
  const connection = await getActiveConnection(organizationId);
  
  if (!connection) {
    throw new Error('No active Xero connection found');
  }
  
  // Initialize Xero client with connection tokens
  const xeroClient = getXeroClient();
  await xeroClient.setTokenSet({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expires_at: connection.expiresAt.getTime(),
  });
  
  // Set active tenant
  xeroClient.tenants = [{
    tenantId: connection.tenantId,
    tenantType: 'ORGANISATION',
    tenantName: '',
    createdDateUtc: new Date(),
    updatedDateUtc: new Date(),
  }];
  
  // Fetch accounts
  try {
    const response = await xeroClient.accountingApi.getAccounts(
      connection.tenantId,
      undefined, // ifModifiedSince
      undefined, // where
      'Code'     // order by code
    );
    
    // Filter to only active accounts
    const activeAccounts = response.body.accounts?.filter(
      account => account.status === 'ACTIVE'
    ) || [];
    
    return {
      accounts: activeAccounts.map(account => ({
        accountID: account.accountID!,
        code: account.code!,
        name: account.name!,
        type: account.type!,
        taxType: account.taxType,
        status: account.status!,
        class: account.class,
      })),
      total: activeAccounts.length,
    };
  } catch (error: any) {
    // Log detailed error information
    console.error('Xero API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      body: error.response?.body,
      tenantId: connection.tenantId,
    });
    
    throw new Error(`Xero API error: ${error.message} (Status: ${error.response?.status || 'unknown'})`);
  }
}

/**
 * Get accounts filtered by type
 */
export async function fetchXeroAccountsByType(
  organizationId: string,
  accountType: string
): Promise<XeroAccount[]> {
  const { accounts } = await fetchXeroAccounts(organizationId);
  return accounts.filter(account => account.type === accountType);
}

/**
 * Search accounts by name or code
 */
export async function searchXeroAccounts(
  organizationId: string,
  searchTerm: string
): Promise<XeroAccount[]> {
  const { accounts } = await fetchXeroAccounts(organizationId);
  const term = searchTerm.toLowerCase();
  
  return accounts.filter(account =>
    account.name.toLowerCase().includes(term) ||
    account.code.toLowerCase().includes(term)
  );
}






