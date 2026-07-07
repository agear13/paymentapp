/**
 * Wise API client.
 * Uses WISE_API_TOKEN and profile from config or param.
 * When credentials are missing, methods throw explicit errors (no mock data in production).
 */

import config from '@/lib/config/env';
import { loggers } from '@/lib/logger';

const WISE_API_BASE_V1 = 'https://api.wise.com/v1';
const WISE_API_BASE_V3 = 'https://api.wise.com/v3';

/** Temporary: set WISE_DEBUG_API=1 to log every outbound Wise HTTP call (invoice-create path). */
export type WiseApiDebugContext = {
  requestLabel: string;
  profileId?: string;
  accountId?: string | number | null;
  currency?: string;
};

export function isWiseApiDebugEnabled(): boolean {
  return ['1', 'true', 'yes'].includes((process.env.WISE_DEBUG_API || '').toLowerCase());
}

export interface WiseQuoteRequest {
  profileId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
}

export interface WiseQuote {
  id: number;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount?: number;
  targetAmount?: number;
  rate: number;
  rateType: string;
  createdTime: string;
  expiresAt?: string;
}

export interface WiseTransferRequest {
  quoteId: number;
  targetAccountId?: number;
  customerTransactionId: string; // idempotency / reference
  details: {
    reference?: string;
    transferPurpose?: string;
  };
}

export interface WiseTransfer {
  id: number;
  quoteId: number;
  status: string;
  rate: number;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  created: string;
  reference?: string;
}

export interface WisePayerInstructions {
  type: 'bank_transfer';
  accountHolderName: string;
  currency: string;
  bankDetails?: {
    legalName: string;
    bic?: string;
    accountNumber?: string;
    sortCode?: string;
    iban?: string;
    routingNumber?: string;
  };
  reference: string;
  transferId: string;
  quoteId: number;
}

function getAuthHeader(): string | null {
  const token = config.wise?.apiToken ?? process.env.WISE_API_TOKEN;
  return token ? `Bearer ${token}` : null;
}

export function hasWiseCredentials(): boolean {
  return !!getAuthHeader();
}

async function wiseFetch<T>(
  path: string,
  options: RequestInit = {},
  apiVersion: 'v1' | 'v3' = 'v3',
  debug?: WiseApiDebugContext
): Promise<T> {
  const auth = getAuthHeader();
  if (!auth) {
    throw new Error('WISE_API_TOKEN missing; Wise is not configured');
  }
  const base = apiVersion === 'v1' ? WISE_API_BASE_V1 : WISE_API_BASE_V3;
  const url = `${base}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: auth,
    ...((options.headers as Record<string, string>) || {}),
  };

  if (isWiseApiDebugEnabled()) {
    loggers.payment.info(
      {
        wiseDebug: true,
        phase: 'outbound',
        requestLabel: debug?.requestLabel ?? null,
        httpMethod: method,
        fullUrl: url,
        profileId: debug?.profileId ?? null,
        accountId: debug?.accountId ?? null,
        currency: debug?.currency ?? null,
      },
      'WISE_API_DEBUG request'
    );
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();

  if (isWiseApiDebugEnabled()) {
    loggers.payment.info(
      {
        wiseDebug: true,
        phase: 'inbound',
        requestLabel: debug?.requestLabel ?? null,
        httpMethod: method,
        fullUrl: url,
        responseStatus: res.status,
        responseBody: text,
        profileId: debug?.profileId ?? null,
        accountId: debug?.accountId ?? null,
        currency: debug?.currency ?? null,
      },
      'WISE_API_DEBUG response'
    );
  }

  if (!res.ok) {
    throw new Error(`Wise API ${res.status}: ${text}`);
  }

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

/**
 * Create an authenticated quote (required for creating a transfer).
 */
export async function createQuote(params: WiseQuoteRequest): Promise<WiseQuote> {
  const profileId = params.profileId || config.wise?.profileId || process.env.WISE_PROFILE_ID;
  if (!profileId) {
    throw new Error('Wise profile ID is required to create a quote');
  }
  const body: Record<string, unknown> = {
    sourceCurrency: params.sourceCurrency,
    targetCurrency: params.targetCurrency,
    rateType: 'FIXED',
  };
  if (params.sourceAmount != null) body.sourceAmount = params.sourceAmount;
  else if (params.targetAmount != null) body.targetAmount = params.targetAmount;
  else throw new Error('Either sourceAmount or targetAmount is required');

  const quote = await wiseFetch<WiseQuote>(
    `/profiles/${profileId}/quotes`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  return quote;
}

/**
 * Create a transfer from a quote.
 */
export async function createTransfer(
  profileId: string,
  params: WiseTransferRequest
): Promise<WiseTransfer> {
  const body = {
    targetAccount: params.targetAccountId ? { id: params.targetAccountId } : undefined,
    quoteUuid: params.quoteId,
    customerTransactionId: params.customerTransactionId,
    details: params.details || {},
  };
  const transfer = await wiseFetch<WiseTransfer>(
    `/profiles/${profileId}/transfers`,
    { method: 'POST', body: JSON.stringify(body) }
  );
  return transfer;
}

/**
 * Get transfer by id (for status polling).
 */
export async function getTransfer(
  profileId: string,
  transferId: number
): Promise<WiseTransfer> {
  return wiseFetch<WiseTransfer>(`/profiles/${profileId}/transfers/${transferId}`);
}

/**
 * Get payer instructions (bank details / reference) for a transfer.
 * Wise may return this from transfer or a separate endpoint.
 */
export async function getPayerInstructions(
  profileId: string,
  transferId: number
): Promise<WisePayerInstructions | null> {
  try {
    const instructions = await wiseFetch<WisePayerInstructions>(
      `/profiles/${profileId}/transfers/${transferId}/account`
    );
    return instructions;
  } catch {
    return null;
  }
}

// ============================================================================
// Profile and Account Details APIs (for fetching merchant bank details)
// ============================================================================

export interface WiseProfile {
  id: number;
  type: 'personal' | 'business';
  fullName?: string;
  businessName?: string;
}

export interface WiseBalanceAccount {
  id: number;
  profileId: number;
  currency: string;
  cashAmount: { value: number; currency: string };
  reservedAmount: { value: number; currency: string };
  totalWorth: { value: number; currency: string };
  creationTime: string;
  modificationTime: string;
  visible: boolean;
  primary: boolean;
}

export interface WiseBankDetails {
  id: number;
  currency: string;
  bankCode?: string;
  accountNumber?: string;
  swift?: string;
  iban?: string;
  bankName?: string;
  accountHolderName?: string;
  bankAddress?: {
    addressFirstLine?: string;
    city?: string;
    country?: string;
    postCode?: string;
  };
}

/**
 * Get all profiles for the authenticated user.
 * GET /v1/profiles
 */
export async function getProfiles(): Promise<WiseProfile[]> {
  return wiseFetch<WiseProfile[]>('/profiles', {}, 'v1');
}

/**
 * Get balances for a profile.
 * GET /v1/borderless-accounts?profileId={profileId}
 */
export async function getBalances(profileId: string): Promise<WiseBalanceAccount[]> {
  const response = await wiseFetch<{ balances?: WiseBalanceAccount[] }[]>(
    `/borderless-accounts?profileId=${profileId}`,
    {},
    'v1'
  );
  return response?.[0]?.balances ?? [];
}

/**
 * Get bank details for receiving money into a Wise balance.
 * GET /v1/borderless-accounts/{accountId}/bank-details?currency={currency}
 * 
 * This returns the bank details that payers should use to send money to the merchant's Wise account.
 */
export async function getBankDetails(
  profileId: string,
  currency: string
): Promise<WiseBankDetails[]> {
  if (isWiseApiDebugEnabled()) {
    loggers.payment.info(
      {
        wiseDebug: true,
        phase: 'getBankDetails_start',
        profileId,
        currency,
        flow: 'invoice_creation',
      },
      'WISE_API_DEBUG getBankDetails start (invoice create path)'
    );
  }

  // First get the borderless account ID
  const accounts = await wiseFetch<{ id: number; profileId: number }[]>(
    `/borderless-accounts?profileId=${profileId}`,
    {},
    'v1',
    {
      requestLabel: 'invoice_create_request_1_borderless_accounts',
      profileId,
      currency,
    }
  );

  if (isWiseApiDebugEnabled()) {
    loggers.payment.info(
      {
        wiseDebug: true,
        phase: 'getBankDetails_borderless_accounts_parsed',
        profileId,
        currency,
        responseIsArray: Array.isArray(accounts),
        responseTopLevelKeys:
          accounts && typeof accounts === 'object' && !Array.isArray(accounts)
            ? Object.keys(accounts as object)
            : null,
        responsePreview: accounts,
        parsedAccountIdFromArrayIndex0: Array.isArray(accounts) ? accounts[0]?.id ?? null : null,
        parsedAccountIdFromObjectRoot:
          accounts && typeof accounts === 'object' && !Array.isArray(accounts)
            ? (accounts as { id?: number }).id ?? null
            : null,
      },
      'WISE_API_DEBUG borderless-accounts response shape'
    );
  }

  if (!accounts || accounts.length === 0) {
    throw new Error('No Wise borderless account found for this profile');
  }

  const accountId = accounts[0].id;

  if (isWiseApiDebugEnabled()) {
    loggers.payment.info(
      {
        wiseDebug: true,
        phase: 'getBankDetails_account_id_selected',
        profileId,
        currency,
        accountId: accountId ?? null,
      },
      'WISE_API_DEBUG account ID selected for bank-details request'
    );
  }

  // Get bank details for the specified currency
  const bankDetails = await wiseFetch<WiseBankDetails[]>(
    `/borderless-accounts/${accountId}/bank-details?currency=${currency}`,
    {},
    'v1',
    {
      requestLabel: 'invoice_create_request_2_bank_details',
      profileId,
      accountId,
      currency,
    }
  );

  return bankDetails;
}
