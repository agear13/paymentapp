import { WiseAccountDetailsError } from '@/lib/wise/wise-account-details';

export const WISE_DETAILS_NOT_ISSUED_CODE = 'WISE_DETAILS_NOT_ISSUED' as const;
export const WISE_CONFIG_ERROR_CODE = 'WISE_CONFIG_ERROR' as const;

export type WisePaymentContextErrorBody = {
  code: typeof WISE_DETAILS_NOT_ISSUED_CODE | typeof WISE_CONFIG_ERROR_CODE;
  error?: string;
  currency?: string;
};

/**
 * Maps Wise payment-context failures to API responses for invoice create/update.
 * Does not alter Wise fetch or mapping behaviour.
 */
export function formatWisePaymentContextApiError(
  error: unknown,
  currencyHint?: string
): { status: number; body: WisePaymentContextErrorBody } {
  if (error instanceof WiseAccountDetailsError && error.code === 'NOT_ISSUED') {
    return {
      status: 400,
      body: {
        code: WISE_DETAILS_NOT_ISSUED_CODE,
        currency: currencyHint?.toUpperCase(),
      },
    };
  }

  const message =
    error instanceof Error ? error.message : 'Failed to prepare Wise payment context';

  return {
    status: 400,
    body: {
      code: WISE_CONFIG_ERROR_CODE,
      error: message,
    },
  };
}
