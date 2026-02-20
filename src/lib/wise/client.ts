/**
 * Wise API client (v3).
 * Uses WISE_API_TOKEN and profile from config or param.
 * When credentials are missing, methods return mock data for development.
 */

import config from '@/lib/config/env';

const WISE_API_BASE = 'https://api.wise.com/v3';

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

async function wiseFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const auth = getAuthHeader();
  const url = `${WISE_API_BASE}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (auth) headers['Authorization'] = auth;

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Wise API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Create an authenticated quote (required for creating a transfer).
 */
export async function createQuote(params: WiseQuoteRequest): Promise<WiseQuote> {
  const profileId = params.profileId || config.wise?.profileId || process.env.WISE_PROFILE_ID;
  if (!profileId || !getAuthHeader()) {
    return mockCreateQuote(params);
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
  if (!getAuthHeader()) {
    return mockCreateTransfer(params);
  }
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
  if (!getAuthHeader()) {
    return mockGetTransfer(transferId);
  }
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
  if (!getAuthHeader()) {
    return mockPayerInstructions(transferId);
  }
  try {
    const instructions = await wiseFetch<WisePayerInstructions>(
      `/profiles/${profileId}/transfers/${transferId}/account`
    );
    return instructions;
  } catch {
    return null;
  }
}

// —— Mocks for when API is not configured ——

function mockCreateQuote(params: WiseQuoteRequest): Promise<WiseQuote> {
  const sourceAmount = params.sourceAmount ?? (params.targetAmount ?? 100) * 0.65;
  const targetAmount = params.targetAmount ?? (params.sourceAmount ?? 100) / 0.65;
  return Promise.resolve({
    id: Math.floor(Math.random() * 1e9),
    sourceCurrency: params.sourceCurrency,
    targetCurrency: params.targetCurrency,
    sourceAmount,
    targetAmount,
    rate: 0.65,
    rateType: 'FIXED',
    createdTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
}

function mockCreateTransfer(params: WiseTransferRequest): Promise<WiseTransfer> {
  return Promise.resolve({
    id: Math.floor(Math.random() * 1e9),
    quoteId: params.quoteId,
    status: 'incoming_payment_waiting',
    rate: 0.65,
    sourceCurrency: 'AUD',
    targetCurrency: 'AUD',
    sourceAmount: 100,
    targetAmount: 100,
    created: new Date().toISOString(),
    reference: params.details?.reference,
  });
}

function mockGetTransfer(transferId: number): Promise<WiseTransfer> {
  return Promise.resolve({
    id: transferId,
    quoteId: 1,
    status: 'incoming_payment_waiting',
    rate: 0.65,
    sourceCurrency: 'AUD',
    targetCurrency: 'AUD',
    sourceAmount: 100,
    targetAmount: 100,
    created: new Date().toISOString(),
  });
}

function mockPayerInstructions(transferId: number): WisePayerInstructions | null {
  return {
    type: 'bank_transfer',
    accountHolderName: 'Provvypay (Wise)',
    currency: 'AUD',
    bankDetails: {
      legalName: 'Provvypay Pty Ltd',
      accountNumber: '****1234',
      bic: 'XXXXXXXX',
    },
    reference: `PAY-${transferId}`,
    transferId: String(transferId),
    quoteId: 1,
  };
}
