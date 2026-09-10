import { PayoutReleaseError } from '@/lib/payouts/payout-status-transitions';
import type { AirwallexExecutionCredentials } from '@/lib/payouts/rails/types';

export const AIRWALLEX_SANDBOX_API_HOST = 'api.sandbox.airwallex.com';
export const AIRWALLEX_SANDBOX_API_BASE = `https://${AIRWALLEX_SANDBOX_API_HOST}`;
export const AIRWALLEX_LOGIN_PATH = '/api/v1/authentication/login';
export const AIRWALLEX_TRANSFERS_CREATE_PATH = '/api/v1/transfers/create';
export const AIRWALLEX_TRANSFERS_VALIDATE_PATH = '/api/v1/transfers/validate';
export const AIRWALLEX_QUOTES_CREATE_PATH = '/api/v1/fx/quotes/create';

const TOKEN_SKEW_MS = 60_000;

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

const tokenCache = new Map<string, CachedToken>();

export function resetAirwallexTokenCache(): void {
  tokenCache.clear();
}

export function assertAirwallexSandboxHost(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PayoutReleaseError(
      'AIRWALLEX_SANDBOX_ONLY',
      'Airwallex adapter is sandbox-only and refused an invalid API URL'
    );
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== AIRWALLEX_SANDBOX_API_HOST) {
    throw new PayoutReleaseError(
      'AIRWALLEX_SANDBOX_ONLY',
      'Airwallex adapter is sandbox-only and refuses production or non-sandbox API hosts'
    );
  }
}

export function assertAirwallexSandboxCredentials(
  credentials: AirwallexExecutionCredentials
): void {
  if (credentials.environment !== 'sandbox') {
    throw new PayoutReleaseError(
      'AIRWALLEX_SANDBOX_ONLY',
      'Airwallex adapter is sandbox-only'
    );
  }
}

function cacheKey(credentials: AirwallexExecutionCredentials): string {
  return `${credentials.clientId}:${credentials.loginAsAccountId ?? ''}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export type AirwallexHttpResult = {
  status: number;
  body: Record<string, unknown> | null;
};

function tokenCacheEntry(credentials: AirwallexExecutionCredentials): CachedToken | null {
  const cached = tokenCache.get(cacheKey(credentials));
  if (!cached) return null;
  if (cached.expiresAtMs - TOKEN_SKEW_MS <= Date.now()) return null;
  return cached;
}

async function loginAirwallex(
  credentials: AirwallexExecutionCredentials,
  fetchImpl: typeof fetch
): Promise<string> {
  assertAirwallexSandboxCredentials(credentials);
  const url = `${AIRWALLEX_SANDBOX_API_BASE}${AIRWALLEX_LOGIN_PATH}`;
  assertAirwallexSandboxHost(url);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': credentials.clientId,
    'x-api-key': credentials.apiKey,
  };
  if (credentials.loginAsAccountId) {
    headers['x-login-as'] = credentials.loginAsAccountId;
  }

  const response = await fetchImpl(url, { method: 'POST', headers });
  const raw = asRecord(await response.json().catch(() => null));
  const token = typeof raw?.token === 'string' ? raw.token : null;
  if (!response.ok || !raw || !token) {
    throw new PayoutReleaseError(
      'AIRWALLEX_AUTH_FAILED',
      typeof raw?.message === 'string'
        ? raw.message
        : `Airwallex login failed with HTTP ${response.status}`,
      response.status >= 400 ? response.status : 502
    );
  }

  const expiresAt =
    typeof raw.expires_at === 'string' ? Date.parse(raw.expires_at) : Number.NaN;
  tokenCache.set(cacheKey(credentials), {
    token,
    expiresAtMs: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 30 * 60 * 1000,
  });
  return token;
}

async function bearerToken(
  credentials: AirwallexExecutionCredentials,
  fetchImpl: typeof fetch
): Promise<string> {
  const cached = tokenCacheEntry(credentials);
  if (cached) return cached.token;
  return loginAirwallex(credentials, fetchImpl);
}

export function airwallexTransferPath(transferId: string): string {
  return `/api/v1/transfers/${encodeURIComponent(transferId)}`;
}

export function airwallexTransferCancelPath(transferId: string): string {
  return `/api/v1/transfers/${encodeURIComponent(transferId)}/cancel`;
}

/**
 * Sandbox-only Airwallex HTTP. Always targets api.sandbox.airwallex.com.
 * Sends x-on-behalf-of only when credentials include a connected-account id.
 */
export async function airwallexRequest(input: {
  credentials: AirwallexExecutionCredentials;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<AirwallexHttpResult> {
  assertAirwallexSandboxCredentials(input.credentials);
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${AIRWALLEX_SANDBOX_API_BASE}${input.path}`;
  assertAirwallexSandboxHost(url);

  const token = await bearerToken(input.credentials, fetchImpl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (input.credentials.onBehalfOfAccountId) {
    headers['x-on-behalf-of'] = input.credentials.onBehalfOfAccountId;
  }

  const response = await fetchImpl(url, {
    method: input.method,
    headers,
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const body = asRecord(await response.json().catch(() => null));
  return { status: response.status, body };
}
