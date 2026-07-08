import { describe, expect, it } from '@jest/globals';
import {
  formatWisePaymentContextApiError,
  WISE_CONFIG_ERROR_CODE,
  WISE_DETAILS_NOT_ISSUED_CODE,
} from '@/lib/payments/wise-api-error';
import { WiseAccountDetailsError } from '@/lib/wise/wise-account-details';

describe('formatWisePaymentContextApiError', () => {
  it('maps NOT_ISSUED to WISE_DETAILS_NOT_ISSUED without technical error text', () => {
    const error = new WiseAccountDetailsError(
      'Wise bank account details for AUD are not yet issued',
      'NOT_ISSUED'
    );
    const result = formatWisePaymentContextApiError(error, 'aud');

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      code: WISE_DETAILS_NOT_ISSUED_CODE,
      currency: 'AUD',
    });
    expect(result.body.error).toBeUndefined();
  });

  it('maps other Wise errors to WISE_CONFIG_ERROR with message', () => {
    const result = formatWisePaymentContextApiError(
      new Error('Wise API 401: Unauthorized'),
      'EUR'
    );

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      code: WISE_CONFIG_ERROR_CODE,
      error: 'Wise API 401: Unauthorized',
    });
  });
});
