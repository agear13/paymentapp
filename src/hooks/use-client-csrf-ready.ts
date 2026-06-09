'use client';

import { useEffect, useState } from 'react';
import {
  ensureClientCsrfReady,
  getClientCsrfToken,
} from '@/lib/security/csrf-fetch.client';
import { logCsrfDiag } from '@/lib/security/csrf-diag.client';

export const CSRF_PREPARING_LABEL = 'Preparing secure session...';

export function useClientCsrfReady(): { isReady: boolean; isPreparing: boolean } {
  const [isReady, setIsReady] = useState(() => getClientCsrfToken() !== null);
  const [isPreparing, setIsPreparing] = useState(() => getClientCsrfToken() === null);

  useEffect(() => {
    const effectId = Math.random().toString(36).slice(2, 8);
    let thenExecuted = false;
    let catchExecuted = false;

    logCsrfDiag('useClientCsrfReady', 'effect-start', {
      effectId,
      hasModuleToken: getClientCsrfToken() !== null,
      initialIsReady: isReady,
      initialIsPreparing: isPreparing,
    });

    if (getClientCsrfToken()) {
      logCsrfDiag('useClientCsrfReady', 'effect-early-sync', {
        effectId,
        hasModuleToken: true,
      });
      setIsReady(true);
      setIsPreparing(false);
      return;
    }

    let cancelled = false;
    setIsPreparing(true);
    logCsrfDiag('useClientCsrfReady', 'effect-bootstrap-start', { effectId });

    ensureClientCsrfReady()
      .then(() => {
        thenExecuted = true;
        logCsrfDiag('useClientCsrfReady', 'then', {
          effectId,
          cancelled,
          hasModuleToken: getClientCsrfToken() !== null,
          willSetReady: !cancelled,
        });
        if (!cancelled) {
          setIsReady(true);
          setIsPreparing(false);
          logCsrfDiag('useClientCsrfReady', 'state-updated-ready', {
            effectId,
            isReady: true,
            isPreparing: false,
          });
        }
      })
      .catch((error: unknown) => {
        catchExecuted = true;
        logCsrfDiag('useClientCsrfReady', 'catch', {
          effectId,
          cancelled,
          error: error instanceof Error ? error.message : String(error),
          hasModuleToken: getClientCsrfToken() !== null,
        });
        if (!cancelled) {
          setIsPreparing(false);
          logCsrfDiag('useClientCsrfReady', 'state-updated-failed', {
            effectId,
            isReady: false,
            isPreparing: false,
          });
        }
      });

    return () => {
      cancelled = true;
      logCsrfDiag('useClientCsrfReady', 'cleanup', {
        effectId,
        cancelled: true,
        thenExecutedBeforeCleanup: thenExecuted,
        catchExecutedBeforeCleanup: catchExecuted,
        hasModuleToken: getClientCsrfToken() !== null,
      });
    };
  }, []);

  return { isReady, isPreparing };
}
