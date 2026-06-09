'use client';

import { useEffect } from 'react';
import { ensureClientCsrfReady } from '@/lib/security/csrf-fetch.client';

/**
 * Fetches CSRF token on dashboard mount and patches fetch for same-origin API calls.
 */
export function CsrfBootstrap() {
  useEffect(() => {
    void ensureClientCsrfReady().catch(() => {
      // Dashboard mutations will fail closed until token is available.
    });
  }, []);

  return null;
}
