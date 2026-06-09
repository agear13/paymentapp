'use client';

let csrfToken: string | null = null;
let interceptorInstalled = false;
let csrfReadyPromise: Promise<void> | null = null;
let nativeFetch: typeof window.fetch | null = null;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function installCsrfFetchInterceptor(token: string): void {
  csrfToken = token;
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;

  nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (
      csrfToken &&
      MUTATING.has(method) &&
      url.startsWith('/') &&
      !url.startsWith('/api/public/') &&
      !url.startsWith('/api/stripe/create-checkout-session')
    ) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', csrfToken);
      }
      return nativeFetch!(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
    }

    return nativeFetch!(input, init);
  };
}

export function getClientCsrfToken(): string | null {
  return csrfToken;
}

async function fetchAndInstallCsrfToken(): Promise<void> {
  const response = await fetch('/api/security/csrf-token', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = (await response.json()) as { csrfToken?: unknown };
  if (typeof data.csrfToken !== 'string') {
    throw new Error('Invalid CSRF token response');
  }

  installCsrfFetchInterceptor(data.csrfToken);
}

/**
 * Ensures a CSRF token is installed before authenticated dashboard/onboarding mutations.
 * Concurrent callers share a single in-flight bootstrap request.
 */
export async function ensureClientCsrfReady(): Promise<void> {
  if (csrfToken) return;

  if (!csrfReadyPromise) {
    csrfReadyPromise = fetchAndInstallCsrfToken().finally(() => {
      if (!csrfToken) {
        csrfReadyPromise = null;
      }
    });
  }

  await csrfReadyPromise;
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
  csrfToken = null;
  csrfReadyPromise = null;

  if (interceptorInstalled && nativeFetch && typeof window !== 'undefined') {
    window.fetch = nativeFetch;
  }

  interceptorInstalled = false;
  nativeFetch = null;
}
