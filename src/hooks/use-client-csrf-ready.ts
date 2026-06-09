'use client';

import { useEffect, useState } from 'react';
import {
  ensureClientCsrfReady,
  getClientCsrfToken,
} from '@/lib/security/csrf-fetch.client';

export const CSRF_PREPARING_LABEL = 'Preparing secure session...';

export function useClientCsrfReady(): { isReady: boolean; isPreparing: boolean } {
  const [isReady, setIsReady] = useState(() => getClientCsrfToken() !== null);
  const [isPreparing, setIsPreparing] = useState(() => getClientCsrfToken() === null);

  useEffect(() => {
    if (getClientCsrfToken()) {
      setIsReady(true);
      setIsPreparing(false);
      return;
    }

    let cancelled = false;
    setIsPreparing(true);

    ensureClientCsrfReady()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
          setIsPreparing(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPreparing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { isReady, isPreparing };
}
