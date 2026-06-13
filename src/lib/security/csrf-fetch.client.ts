'use client';

import {
  getProvvyPayCsrfGlobal,
  resetProvvyPayCsrfGlobalForTests,
} from '@/lib/security/csrf-global.client';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function bootstrapFetch(): typeof window.fetch {
  const state = getProvvyPayCsrfGlobal();
  return state.nativeFetch ?? window.fetch.bind(window);
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function isCsrfProtectedSameOriginMutation(url: string, method: string): boolean {
  return (
    MUTATING.has(method) &&
    url.startsWith('/') &&
    !url.startsWith('/api/public/') &&
    !url.startsWith('/api/stripe/create-checkout-session')
  );
}

function withCsrfHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  csrfToken: string
): RequestInit {
  const headers = new Headers(
    init?.headers || (input instanceof Request ? input.headers : undefined)
  );
  if (!headers.has('x-csrf-token')) {
    headers.set('x-csrf-token', csrfToken);
  }

  return {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  };
}

function ensureFetchInterceptorInstalled(): void {
  const state = getProvvyPayCsrfGlobal();
  if (state.interceptorInstalled || typeof window === 'undefined') return;
  if (typeof window.fetch !== 'function') return;
  state.interceptorInstalled = true;

  state.nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const { nativeFetch } = getProvvyPayCsrfGlobal();
    const url = resolveFetchUrl(input);
    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    if (isCsrfProtectedSameOriginMutation(url, method)) {
      await ensureClientCsrfReady().catch(() => undefined);
      const { csrfToken } = getProvvyPayCsrfGlobal();
      if (csrfToken) {
        return nativeFetch!(input, withCsrfHeaders(input, init, csrfToken));
      }
    }

    return nativeFetch!(input, init);
  };
}

export function installCsrfFetchInterceptor(token: string): void {
  const state = getProvvyPayCsrfGlobal();
  state.csrfToken = token;
  ensureFetchInterceptorInstalled();
}

export function getClientCsrfToken(): string | null {
  return getProvvyPayCsrfGlobal().csrfToken;
}

async function fetchAndInstallCsrfToken(): Promise<void> {
  const response = await bootstrapFetch()('/api/security/csrf-token', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = (await response.json()) as { csrfToken?: unknown };
  const bodyToken =
    typeof data.csrfToken === 'string' ? (data.csrfToken as string) : null;

  if (!bodyToken) {
    throw new Error('Invalid CSRF token response');
  }

  installCsrfFetchInterceptor(bodyToken);
}

/**
 * Ensures a CSRF token is installed before authenticated dashboard/onboarding mutations.
 * Concurrent callers — including separate bundled module instances — share one bootstrap.
 */
export async function ensureClientCsrfReady(): Promise<void> {
  ensureFetchInterceptorInstalled();
  const state = getProvvyPayCsrfGlobal();

  if (state.csrfToken) {
    return;
  }

  if (!state.csrfReadyPromise) {
    state.csrfReadyPromise = fetchAndInstallCsrfToken().finally(() => {
      const current = getProvvyPayCsrfGlobal();
      if (!current.csrfToken) {
        current.csrfReadyPromise = null;
      }
    });
  }

  await state.csrfReadyPromise;
}

/**
 * Same-origin API fetch that waits for CSRF readiness before mutating requests run.
 */
export async function csrfAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  await ensureClientCsrfReady();
  return fetch(input, init);
}

/** @internal Reset module state between tests. */
export function resetClientCsrfStateForTests(): void {
  const state = getProvvyPayCsrfGlobal();

  if (state.interceptorInstalled && state.nativeFetch && typeof window !== 'undefined') {
    window.fetch = state.nativeFetch;
  }

  resetProvvyPayCsrfGlobalForTests();
}
