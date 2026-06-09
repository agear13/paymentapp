'use client';

import { logCsrfDiag } from '@/lib/security/csrf-diag.client';

/** TEMP: identifies duplicate client module instances in lifecycle logs. */
const CSRF_MODULE_INSTANCE_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

let csrfToken: string | null = null;
let interceptorInstalled = false;
let csrfReadyPromise: Promise<void> | null = null;
let nativeFetch: typeof window.fetch | null = null;
let csrfIssuanceGeneration = 0;

function previewToken(value: string | null | undefined): string | null {
  if (!value) return null;
  return `${value.slice(0, 12)}...`;
}

function logTokenLifecycle(
  event: string,
  details?: Record<string, unknown>
): void {
  logCsrfDiag('tokenLifecycle', event, {
    moduleInstanceId: CSRF_MODULE_INSTANCE_ID,
    issuanceGeneration: csrfIssuanceGeneration,
    moduleTokenPreview: previewToken(csrfToken),
    interceptorInstalled,
    hasInFlightPromise: csrfReadyPromise !== null,
    ...details,
  });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function installCsrfFetchInterceptor(token: string, source?: string): void {
  const previousPreview = previewToken(csrfToken);
  csrfToken = token;
  logTokenLifecycle('install-interceptor', {
    source: source ?? 'unknown',
    previousTokenPreview: previousPreview,
    installedTokenPreview: previewToken(token),
    willPatchFetch: !interceptorInstalled && typeof window !== 'undefined',
  });
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
      const hadHeader = headers.has('x-csrf-token');
      if (!hadHeader) {
        headers.set('x-csrf-token', csrfToken);
      }
      if (url === '/api/onboarding/bootstrap-workspace' || url.endsWith('/api/onboarding/bootstrap-workspace')) {
        const headerValue = hadHeader ? headers.get('x-csrf-token') : csrfToken;
        logTokenLifecycle('bootstrap-workspace-mutation', {
          method,
          headerWasPresent: hadHeader,
          headerValuePreview: previewToken(headerValue),
          moduleTokenPreview: previewToken(csrfToken),
          credentials: init?.credentials ?? 'include',
        });
      }
      return nativeFetch!(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
    }

    if (
      MUTATING.has(method) &&
      (url === '/api/onboarding/bootstrap-workspace' || url.endsWith('/api/onboarding/bootstrap-workspace'))
    ) {
      logCsrfDiag('fetchInterceptor', 'bootstrap-workspace-unpatched', {
        method,
        hasModuleToken: csrfToken !== null,
        reason: !csrfToken ? 'no_module_token' : 'path_not_intercepted',
      });
    }

    return nativeFetch!(input, init);
  };
}

export function getClientCsrfToken(): string | null {
  return csrfToken;
}

async function fetchAndInstallCsrfToken(source: string): Promise<void> {
  const issuanceGeneration = ++csrfIssuanceGeneration;
  logTokenLifecycle('csrf-token-fetch-start', {
    source,
    issuanceGeneration,
    moduleTokenBeforeFetch: previewToken(csrfToken),
  });

  const response = await fetch('/api/security/csrf-token', { credentials: 'include' });

  logTokenLifecycle('csrf-token-fetch-response', {
    source,
    issuanceGeneration,
    ok: response.ok,
    status: response.status,
    contentType: response.headers?.get?.('content-type') ?? null,
    moduleTokenAfterHttpResponse: previewToken(csrfToken),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }

  const data = (await response.json()) as { csrfToken?: unknown };
  const bodyToken =
    typeof data.csrfToken === 'string' ? (data.csrfToken as string) : null;

  logTokenLifecycle('csrf-token-json-parsed', {
    source,
    issuanceGeneration,
    csrfTokenType: typeof data.csrfToken,
    bodyTokenPreview: previewToken(bodyToken),
    moduleTokenBeforeInstall: previewToken(csrfToken),
  });

  if (!bodyToken) {
    throw new Error('Invalid CSRF token response');
  }

  installCsrfFetchInterceptor(bodyToken, source);
  logTokenLifecycle('csrf-token-installed', {
    source,
    issuanceGeneration,
    bodyTokenPreview: previewToken(bodyToken),
    moduleTokenAfterInstall: previewToken(csrfToken),
  });
}

/**
 * Ensures a CSRF token is installed before authenticated dashboard/onboarding mutations.
 * Concurrent callers share a single in-flight bootstrap request.
 */
export async function ensureClientCsrfReady(source = 'unspecified'): Promise<void> {
  logTokenLifecycle('ensure-start', { source });

  if (csrfToken) {
    logTokenLifecycle('ensure-skip-existing-token', {
      source,
      moduleTokenPreview: previewToken(csrfToken),
    });
    return;
  }

  if (!csrfReadyPromise) {
    csrfReadyPromise = fetchAndInstallCsrfToken(source).finally(() => {
      logCsrfDiag('ensureClientCsrfReady', 'promise-finally', {
        hasModuleToken: csrfToken !== null,
        clearingInFlightPromise: csrfToken === null,
      });
      if (!csrfToken) {
        csrfReadyPromise = null;
      }
    });
  }

  try {
    await csrfReadyPromise;
    logTokenLifecycle('ensure-resolved', {
      source,
      moduleTokenPreview: previewToken(csrfToken),
    });
  } catch (error) {
    logTokenLifecycle('ensure-rejected', {
      source,
      error: error instanceof Error ? error.message : String(error),
      moduleTokenPreview: previewToken(csrfToken),
    });
    throw error;
  }
}

/**
 * Same-origin API fetch that waits for CSRF readiness before mutating requests run.
 */
export async function csrfAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  await ensureClientCsrfReady('csrfAwareFetch');
  return fetch(input, init);
}

/** @internal Reset module state between tests. */
export function resetClientCsrfStateForTests(): void {
  csrfToken = null;
  csrfReadyPromise = null;
  csrfIssuanceGeneration = 0;

  if (interceptorInstalled && nativeFetch && typeof window !== 'undefined') {
    window.fetch = nativeFetch;
  }

  interceptorInstalled = false;
  nativeFetch = null;
}
