import type { ReleaseInteractionState } from '@/lib/operations/capabilities/derive-release-interaction-state';

/** True when a 403 is expected during beta lockdown or pre-convergence — never toast. */
export function isExpectedOperationalForbidden(
  status: number,
  releaseInteraction: Pick<
    ReleaseInteractionState,
    'releaseInteractionEnabled' | 'disabledCategory'
  >
): boolean {
  if (status !== 403) return false;
  return (
    !releaseInteraction.releaseInteractionEnabled ||
    releaseInteraction.disabledCategory === 'beta_locked' ||
    releaseInteraction.disabledCategory === 'settlement_initializing' ||
    releaseInteraction.disabledCategory === 'graph_converging' ||
    releaseInteraction.disabledCategory === 'activation_loading'
  );
}

export function shouldSuppressOperationalErrorToast(input: {
  status?: number;
  message?: string;
  releaseInteraction: Pick<
    ReleaseInteractionState,
    'releaseInteractionEnabled' | 'disabledCategory'
  >;
}): boolean {
  if (input.status != null && isExpectedOperationalForbidden(input.status, input.releaseInteraction)) {
    return true;
  }
  const lower = (input.message ?? '').toLowerCase();
  if (
    lower.includes('forbidden') &&
    lower.includes('beta') &&
    !input.releaseInteraction.releaseInteractionEnabled
  ) {
    return true;
  }
  return false;
}
