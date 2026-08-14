/**
 * Shared Wise HTTP helpers (v1 API for profiles, balances, statements).
 */

import config from '@/lib/config/env';
import { loggers } from '@/lib/logger';
import type { WiseApiDebugContext } from '@/lib/wise/client';
import { isWiseApiDebugEnabled } from '@/lib/wise/client';

const WISE_API_BASE_V1 = 'https://api.wise.com/v1';

function getAuthHeader(): string | null {
  const token = config.wise?.apiToken ?? process.env.WISE_API_TOKEN;
  return token ? `Bearer ${token}` : null;
}

export async function wiseFetchV1<T>(
  path: string,
  options: RequestInit = {},
  debug?: WiseApiDebugContext
): Promise<T> {
  const auth = getAuthHeader();
  if (!auth) {
    throw new Error('WISE_API_TOKEN missing; Wise is not configured');
  }

  const url = `${WISE_API_BASE_V1}${path}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: auth,
    ...((options.headers as Record<string, string>) || {}),
  };

  const requestBody =
    typeof options.body === 'string'
      ? options.body
      : options.body != null
        ? String(options.body)
        : null;

  const auditPayload = {
    requestLabel: debug?.requestLabel ?? null,
    httpMethod: method,
    fullUrl: url,
    requestBody,
    profileId: debug?.profileId ?? null,
    accountId: debug?.accountId ?? null,
    currency: debug?.currency ?? null,
  };

  if (debug?.auditUnconditionally) {
    loggers.payment.error('WISE_HTTP request', undefined, auditPayload);
  } else if (isWiseApiDebugEnabled()) {
    loggers.payment.info({ wiseDebug: true, phase: 'outbound', ...auditPayload }, 'WISE_API_DEBUG request');
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();

  const responsePayload = {
    ...auditPayload,
    responseStatus: res.status,
    responseBody: text,
  };

  if (debug?.auditUnconditionally) {
    loggers.payment.error('WISE_HTTP response', undefined, responsePayload);
  } else if (isWiseApiDebugEnabled()) {
    loggers.payment.info({ wiseDebug: true, phase: 'inbound', ...responsePayload }, 'WISE_API_DEBUG response');
  }

  if (!res.ok) {
    throw new Error(`Wise API ${res.status}: ${text}`);
  }

  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}
