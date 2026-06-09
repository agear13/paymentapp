'use client';

/** TEMP: remove after onboarding CSRF readiness debugging. */
export function logCsrfDiag(
  source: string,
  event: string,
  details?: Record<string, unknown>
): void {
  console.log(`[CSRF-DIAG] ${source} :: ${event}`, {
    ts:
      typeof performance !== 'undefined'
        ? Math.round(performance.now())
        : Date.now(),
    ...details,
  });
}
