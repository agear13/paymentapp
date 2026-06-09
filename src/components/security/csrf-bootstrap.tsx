'use client';

import { useEffect } from 'react';
import { installCsrfFetchInterceptor } from '@/lib/security/csrf-fetch.client';

/**
 * Fetches CSRF token on dashboard mount and patches fetch for same-origin API calls.
 */
export function CsrfBootstrap() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/security/csrf-token', { credentials: 'include' });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (typeof data.csrfToken === 'string') {
          installCsrfFetchInterceptor(data.csrfToken);
        }
      } catch {
        // Dashboard mutations will fail closed until token is available.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
