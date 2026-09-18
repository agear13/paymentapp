import { parseDelayedPaymentDays, textAlreadyHasEarlyPaymentDiscount } from '@/lib/commercial-incentive/detect-delayed-terms';

describe('delayed payment term detection', () => {
  it('recognises Net 30 / 45 / 60', () => {
    expect(parseDelayedPaymentDays('Net 30')).toBe(30);
    expect(parseDelayedPaymentDays('Net 45')).toBe(45);
    expect(parseDelayedPaymentDays('Net 60')).toBe(60);
  });

  it('recognises within N days of invoice date', () => {
    expect(parseDelayedPaymentDays('Within 30 days of invoice date')).toBe(30);
    expect(parseDelayedPaymentDays('within 45 days of invoice date')).toBe(45);
    expect(parseDelayedPaymentDays('within 60 days of invoice date')).toBe(60);
  });

  it('recognises payable within N days', () => {
    expect(
      parseDelayedPaymentDays('Each milestone invoice payable within 30 days of invoice date')
    ).toBe(30);
  });

  it('does not invent timing from absent or ambiguous text', () => {
    expect(parseDelayedPaymentDays(null)).toBeNull();
    expect(parseDelayedPaymentDays('as agreed')).toBeNull();
    expect(parseDelayedPaymentDays('Due on delivery')).toBeNull();
  });

  it('does not treat “No early-payment discount included” as an existing incentive', () => {
    expect(
      textAlreadyHasEarlyPaymentDiscount('No early-payment discount included.')
    ).toBe(false);
    expect(
      textAlreadyHasEarlyPaymentDiscount(
        "Payment by bank transfer. No early-payment discount included."
      )
    ).toBe(false);
  });

  it('still detects a real extracted early-payment discount', () => {
    expect(textAlreadyHasEarlyPaymentDiscount('2% discount if paid within 7 days')).toBe(true);
    expect(textAlreadyHasEarlyPaymentDiscount('Early pay 2% if paid within 7 days')).toBe(true);
  });
});
