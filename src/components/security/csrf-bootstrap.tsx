'use client';

import { useEffect } from 'react';
import { ensureClientCsrfReady } from '@/lib/security/csrf-fetch.client';
import { logCsrfDiag } from '@/lib/security/csrf-diag.client';

/**
 * Fetches CSRF token on dashboard mount and patches fetch for same-origin API calls.
 */
export function CsrfBootstrap() {
  useEffect(() => {
    logCsrfDiag('CsrfBootstrap', 'effect-start');
    void ensureClientCsrfReady()
      .then(() => {
        logCsrfDiag('CsrfBootstrap', 'resolved');
      })
      .catch((error: unknown) => {
        logCsrfDiag('CsrfBootstrap', 'rejected', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Dashboard mutations will fail closed until token is available.
      });
  }, []);

  return null;
}
