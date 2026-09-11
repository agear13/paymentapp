import 'server-only';

import config from '@/lib/config/env';
import { log } from '@/lib/logger';

const WISE_QUOTE_HOST = 'api.wise.com';
const WISE_QUOTE_PATH_PREFIX = '/v3/profiles/';
const WISE_QUOTE_PATH_SUFFIX = '/quotes';
const FETCH_TIMEOUT_MS = 10_000;

export type WiseQuoteRequestFailureReason =
  | 'missing_credentials'
  | 'missing_profile'
  | 'http_failure'
  | 'timeout'
  | 'malformed';

export type WiseQuoteRequestResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: WiseQuoteRequestFailureReason };

function authHeader(): string | null {
  const token = config.wise?.apiToken ?? process.env.WISE_API_TOKEN;
  return token ? `Bearer ${token}` : null;
}

function isAllowlistedQuoteUrl(url: string, profileId: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === WISE_QUOTE_HOST &&
      parsed.username === '' &&
      parsed.password === '' &&
      parsed.pathname === `${WISE_QUOTE_PATH_PREFIX}${profileId}${WISE_QUOTE_PATH_SUFFIX}`
    );
  } catch {
    return false;
  }
}

/**
 * POST /v3/profiles/{profileId}/quotes — creates a quote only.
 * Does not create a transfer and must not be used to execute a payment.
 */
export async function requestWiseFlagshipQuote(input: {
  profileId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<WiseQuoteRequestResult> {
  const profileId = input.profileId.trim();
  if (!profileId) return { ok: false, reason: 'missing_profile' };

  const auth = authHeader();
  if (!auth) return { ok: false, reason: 'missing_credentials' };

  const url = `https://${WISE_QUOTE_HOST}${WISE_QUOTE_PATH_PREFIX}${profileId}${WISE_QUOTE_PATH_SUFFIX}`;
  if (!isAllowlistedQuoteUrl(url, profileId)) {
    return { ok: false, reason: 'http_failure' };
  }

  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? FETCH_TIMEOUT_MS);

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sourceCurrency: input.sourceCurrency,
        targetCurrency: input.targetCurrency,
        sourceAmount: input.sourceAmount,
        rateType: 'FIXED',
      }),
      redirect: 'error',
      signal: controller.signal,
    });

    if (!response.ok) {
      log.warn('Connected Wise quote request failed closed', {
        status: response.status,
        profilePresent: true,
      });
      return { ok: false, reason: 'http_failure' };
    }

    const payload: unknown = await response.json();
    if (payload === null || typeof payload !== 'object') {
      return { ok: false, reason: 'malformed' };
    }
    return { ok: true, payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    log.warn('Connected Wise quote request failed closed', {
      reason: timedOut ? 'timeout' : 'http_failure',
    });
    return { ok: false, reason: timedOut ? 'timeout' : 'http_failure' };
  } finally {
    clearTimeout(timer);
  }
}
