import { formatPaymentLinkApiValidationMessage } from '@/lib/payment-links/payment-link-api-validation-error';

describe('formatPaymentLinkApiValidationMessage', () => {
  it('surfaces the first structured validation detail', () => {
    expect(
      formatPaymentLinkApiValidationMessage({
        error: 'Validation error',
        details: [
          {
            field: 'customerPhone',
            message: 'Enter a valid phone number (e.g. 0412 345 678 or +61412345678).',
          },
        ],
      })
    ).toBe(
      'Invoice could not be created: Enter a valid phone number (e.g. 0412 345 678 or +61412345678).'
    );
  });

  it('falls back to generic error when details are missing', () => {
    expect(
      formatPaymentLinkApiValidationMessage({
        error: 'Validation error',
      })
    ).toBe('Validation error');
  });

  it('uses custom fallback when body is empty', () => {
    expect(formatPaymentLinkApiValidationMessage({}, 'Custom fallback')).toBe('Custom fallback');
  });
});
