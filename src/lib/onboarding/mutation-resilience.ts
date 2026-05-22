/**
 * Onboarding mutation resilience — recoverable outcomes, retry safety, operator-facing copy.
 */

export type MutationStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'RECOVERABLE_FAILURE'
  | 'NON_RECOVERABLE_FAILURE';

export type MutationResult<T = unknown> = {
  status: MutationStatus;
  data?: T;
  retryRecommended: boolean;
  safeToRetry: boolean;
  preservedDraft: boolean;
  operationReference: string;
  recoveryMessage: string;
  operationalWarning?: string;
  /** Internal only — never expose raw message to UI */
  internalCause?: string;
};

export function createOperationId(): string {
  return `onb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function successResult<T>(
  data: T,
  operationReference: string,
  partial?: { operationalWarning?: string }
): MutationResult<T> {
  const status = partial?.operationalWarning ? 'PARTIAL_SUCCESS' : 'SUCCESS';
  return {
    status,
    data,
    retryRecommended: false,
    safeToRetry: false,
    preservedDraft: true,
    operationReference,
    recoveryMessage:
      status === 'PARTIAL_SUCCESS'
        ? 'Your project was created. Some operational setup is still processing — you can continue safely.'
        : 'Your project was created successfully.',
    operationalWarning: partial?.operationalWarning,
  };
}

export function recoverableFailure(
  operationReference: string,
  recoveryMessage: string,
  internalCause?: string
): MutationResult<never> {
  return {
    status: 'RECOVERABLE_FAILURE',
    retryRecommended: true,
    safeToRetry: true,
    preservedDraft: true,
    operationReference,
    recoveryMessage,
    internalCause,
  };
}

export function nonRecoverableFailure(
  operationReference: string,
  recoveryMessage: string,
  internalCause?: string
): MutationResult<never> {
  return {
    status: 'NON_RECOVERABLE_FAILURE',
    retryRecommended: false,
    safeToRetry: false,
    preservedDraft: true,
    operationReference,
    recoveryMessage,
    internalCause,
  };
}

export function classifyMutationError(error: unknown): {
  recoverable: boolean;
  internalCause: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('unique constraint') ||
    lower.includes('already exists') ||
    lower.includes('duplicate')
  ) {
    return { recoverable: true, internalCause: message };
  }
  if (
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('validation')
  ) {
    return { recoverable: false, internalCause: message };
  }
  if (
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('connection')
  ) {
    return { recoverable: true, internalCause: message };
  }
  return { recoverable: true, internalCause: message };
}

export async function safeMutation<T>(
  operationReference: string,
  fn: () => Promise<T>,
  options?: {
    onPartial?: (data: T, warning: string) => MutationResult<T>;
  }
): Promise<MutationResult<T>> {
  try {
    const data = await fn();
    return successResult(data, operationReference);
  } catch (error) {
    const { recoverable, internalCause } = classifyMutationError(error);
    if (recoverable) {
      return recoverableFailure(
        operationReference,
        'We could not finish configuring your project yet. Your project details were preserved safely.',
        internalCause
      );
    }
    return nonRecoverableFailure(
      operationReference,
      'We could not complete workspace setup. Your details are preserved — contact support if this continues.',
      internalCause
    );
  }
}

/** Strip internal fields before API response */
export function toClientMutationResult<T>(result: MutationResult<T>) {
  const { internalCause: _i, ...client } = result;
  return client;
}
