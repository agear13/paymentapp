'use client';

let csrfToken: string | null = null;
let interceptorInstalled = false;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function installCsrfFetchInterceptor(token: string): void {
  csrfToken = token;
  if (interceptorInstalled || typeof window === 'undefined') return;
  interceptorInstalled = true;

  const nativeFetch = window.fetch.bind(window);
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
      return nativeFetch(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
    }

    return nativeFetch(input, init);
  };
}

export function getClientCsrfToken(): string | null {
  return csrfToken;
}
