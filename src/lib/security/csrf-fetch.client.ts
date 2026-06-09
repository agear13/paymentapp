'use client';

import { logCsrfDiag } from '@/lib/security/csrf-diag.client';
import {
  getActivePatchOwnerId,
  getCsrfInstanceRegistrySummary,
  getLastBootstrapWorkspaceProof,
  registerCsrfModuleInstance,
  recordCsrfInstall,
  resetCsrfProofStateForTests,
  setLastBootstrapWorkspaceProof,
  sha256Hex,
  type BootstrapWorkspaceProof,
} from '@/lib/security/csrf-proof.client';

/** TEMP: identifies duplicate client module instances in lifecycle logs. */
const CSRF_MODULE_INSTANCE_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);

const MODULE_REGISTRY = registerCsrfModuleInstance(CSRF_MODULE_INSTANCE_ID);

logCsrfDiag('tokenLifecycle', 'module-loaded', {
  moduleInstanceId: CSRF_MODULE_INSTANCE_ID,
  uniqueInstanceCount: MODULE_REGISTRY.uniqueInstanceCount,
  allInstanceIds: MODULE_REGISTRY.allInstanceIds,
  loadedAt: Math.round(performance.now()),
});

let csrfToken: string | null = null;
let interceptorInstalled = false;
let csrfReadyPromise: Promise<void> | null = null;
let nativeFetch: typeof window.fetch | null = null;
let csrfIssuanceGeneration = 0;
let installInterceptorAt: number | null = null;
let patchedWindowFetch = false;

function previewToken(value: string | null | undefined): string | null {
  if (!value) return null;
  return `${value.slice(0, 12)}...`;
}

function logTokenLifecycle(
  event: string,
  details?: Record<string, unknown>
): void {
  const registry = getCsrfInstanceRegistrySummary();
  logCsrfDiag('tokenLifecycle', event, {
    moduleInstanceId: CSRF_MODULE_INSTANCE_ID,
    issuanceGeneration: csrfIssuanceGeneration,
    moduleTokenPreview: previewToken(csrfToken),
    interceptorInstalled,
    patchedWindowFetch,
    installInterceptorAt,
    activePatchOwnerId: registry.activePatchOwnerId,
    uniqueInstanceCount: registry.uniqueInstanceCount,
    allInstanceIds: registry.allInstanceIds,
    hasInFlightPromise: csrfReadyPromise !== null,
    ...details,
  });
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function recordInstallProof(token: string, source: string, willPatchFetch: boolean): Promise<void> {
  const moduleTokenSha256 = await sha256Hex(token);
  const installTs = recordCsrfInstall(CSRF_MODULE_INSTANCE_ID, {
    patchedWindowFetch: willPatchFetch,
    moduleTokenSha256,
  });
  installInterceptorAt = installTs;
  patchedWindowFetch = willPatchFetch;

  logTokenLifecycle('install-interceptor', {
    source,
    installInterceptorAt: installTs,
    patchedWindowFetch: willPatchFetch,
    moduleTokenSha256,
    activePatchOwnerId: getActivePatchOwnerId(),
  });
}

export function installCsrfFetchInterceptor(token: string, source?: string): void {
  const previousPreview = previewToken(csrfToken);
  const willPatchFetch = !interceptorInstalled && typeof window !== 'undefined';
  csrfToken = token;

  void recordInstallProof(token, source ?? 'unknown', willPatchFetch).catch(() => {
    logTokenLifecycle('install-interceptor-proof-failed', {
      source: source ?? 'unknown',
      previousTokenPreview: previousPreview,
      installedTokenPreview: previewToken(token),
      willPatchFetch,
    });
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
        const requestTs = Math.round(performance.now());
        const headerTokenSha256 = headerValue ? await sha256Hex(headerValue) : null;
        const moduleTokenSha256 = csrfToken ? await sha256Hex(csrfToken) : null;
        const proof: BootstrapWorkspaceProof = {
          moduleInstanceId: CSRF_MODULE_INSTANCE_ID,
          requestTs,
          headerTokenSha256,
          moduleTokenSha256,
          patchedWindowFetchByThisInstance: patchedWindowFetch,
          activePatchOwnerId: getActivePatchOwnerId(),
          headerWasPresent: hadHeader,
        };
        setLastBootstrapWorkspaceProof(proof);

        logTokenLifecycle('bootstrap-workspace-request', {
          requestTs,
          method,
          headerWasPresent: hadHeader,
          headerTokenSha256,
          moduleTokenSha256,
          patchedWindowFetchByThisInstance: patchedWindowFetch,
          activePatchOwnerId: proof.activePatchOwnerId,
          headerGeneratorInstanceId: CSRF_MODULE_INSTANCE_ID,
        });
      }

      return nativeFetch!(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
    }

    if (
      MUTATING.has(method) &&
      (url === '/api/onboarding/bootstrap-workspace' || url.endsWith('/api/onboarding/bootstrap-workspace'))
    ) {
      logTokenLifecycle('bootstrap-workspace-unpatched', {
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

export function getCsrfModuleInstanceId(): string {
  return CSRF_MODULE_INSTANCE_ID;
}

type ServerCsrfDiag = {
  cookieTokenSha256?: string | null;
  headerTokenSha256?: string | null;
  failingBranch?: string;
};

/** TEMP: correlate client proof with server 403 diagnostics. */
export function logBootstrapWorkspace403Proof(serverCsrfDiag: ServerCsrfDiag | null | undefined): void {
  const last = getLastBootstrapWorkspaceProof();
  const registry = getCsrfInstanceRegistrySummary();
  const headerSha = serverCsrfDiag?.headerTokenSha256 ?? last?.headerTokenSha256 ?? null;
  const cookieSha = serverCsrfDiag?.cookieTokenSha256 ?? null;
  const moduleSha = last?.moduleTokenSha256 ?? null;

  const headerMatchesModule = Boolean(headerSha && moduleSha && headerSha === moduleSha);
  const headerDiffersFromCookie = Boolean(headerSha && cookieSha && headerSha !== cookieSha);
  const staleInterceptor = headerMatchesModule && headerDiffersFromCookie;

  logCsrfDiag('csrf403Proof', 'bootstrap-workspace', {
    headerGeneratorInstanceId: last?.moduleInstanceId ?? null,
    activePatchOwnerId: registry.activePatchOwnerId,
    SHA256_header: headerSha,
    SHA256_cookie: cookieSha,
    SHA256_module: moduleSha,
    headerMatchesModule,
    headerDiffersFromCookie,
    staleInterceptor,
    failingBranch: serverCsrfDiag?.failingBranch ?? null,
    uniqueInstanceCount: registry.uniqueInstanceCount,
    allInstanceIds: registry.allInstanceIds,
    installInterceptorAt: installInterceptorAt,
    bootstrapRequestTs: last?.requestTs ?? null,
    patchedWindowFetchByRequestInstance: last?.patchedWindowFetchByThisInstance ?? null,
    instances: registry.instances,
    lastBootstrapProof: last,
  });
}

async function fetchAndInstallCsrfToken(source: string): Promise<void> {
  const issuanceGeneration = ++csrfIssuanceGeneration;
  logTokenLifecycle('csrf-token-fetch-start', {
    source,
    issuanceGeneration,
    moduleTokenSha256: csrfToken ? await sha256Hex(csrfToken) : null,
  });

  const response = await fetch('/api/security/csrf-token', { credentials: 'include' });

  logTokenLifecycle('csrf-token-fetch-response', {
    source,
    issuanceGeneration,
    ok: response.ok,
    status: response.status,
    contentType: response.headers?.get?.('content-type') ?? null,
    moduleTokenSha256: csrfToken ? await sha256Hex(csrfToken) : null,
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
    bodyTokenSha256: bodyToken ? await sha256Hex(bodyToken) : null,
    moduleTokenSha256: csrfToken ? await sha256Hex(csrfToken) : null,
  });

  if (!bodyToken) {
    throw new Error('Invalid CSRF token response');
  }

  installCsrfFetchInterceptor(bodyToken, source);
  logTokenLifecycle('csrf-token-installed', {
    source,
    issuanceGeneration,
    bodyTokenSha256: await sha256Hex(bodyToken),
    moduleTokenSha256: await sha256Hex(csrfToken!),
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
      moduleTokenSha256: await sha256Hex(csrfToken),
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
      moduleTokenSha256: csrfToken ? await sha256Hex(csrfToken) : null,
    });
  } catch (error) {
    logTokenLifecycle('ensure-rejected', {
      source,
      error: error instanceof Error ? error.message : String(error),
      moduleTokenSha256: csrfToken ? await sha256Hex(csrfToken) : null,
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
  installInterceptorAt = null;
  patchedWindowFetch = false;

  if (interceptorInstalled && nativeFetch && typeof window !== 'undefined') {
    window.fetch = nativeFetch;
  }

  interceptorInstalled = false;
  nativeFetch = null;
  resetCsrfProofStateForTests();
}
