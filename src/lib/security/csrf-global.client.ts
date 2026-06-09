'use client';

export type ProvvyPayCsrfGlobal = {
  csrfToken: string | null;
  csrfReadyPromise: Promise<void> | null;
  interceptorInstalled: boolean;
  nativeFetch: typeof window.fetch | null;
};

const GLOBAL_KEY = '__PROVVYPAY_CSRF__';

type ProvvyPayCsrfWindow = Window & {
  [GLOBAL_KEY]?: ProvvyPayCsrfGlobal;
};

const SSR_FALLBACK: ProvvyPayCsrfGlobal = {
  csrfToken: null,
  csrfReadyPromise: null,
  interceptorInstalled: false,
  nativeFetch: null,
};

/** Shared CSRF state across all bundled copies of csrf-fetch.client.ts. */
export function getProvvyPayCsrfGlobal(): ProvvyPayCsrfGlobal {
  if (typeof window === 'undefined') {
    return SSR_FALLBACK;
  }

  const win = window as ProvvyPayCsrfWindow;
  win[GLOBAL_KEY] ??= {
    csrfToken: null,
    csrfReadyPromise: null,
    interceptorInstalled: false,
    nativeFetch: null,
  };

  return win[GLOBAL_KEY]!;
}

/** @internal Reset global state between tests. */
export function resetProvvyPayCsrfGlobalForTests(): void {
  if (typeof window === 'undefined') return;
  delete (window as ProvvyPayCsrfWindow)[GLOBAL_KEY];
}
