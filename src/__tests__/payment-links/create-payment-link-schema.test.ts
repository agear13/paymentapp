import { CreatePaymentLinkSchema } from '@/lib/validations/schemas';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

function parsePayload(body: Record<string, unknown>) {
  return CreatePaymentLinkSchema.safeParse({ ...body, organizationId: ORG_ID });
}

function firstIssue(result: ReturnType<typeof parsePayload>) {
  if (result.success) return null;
  return result.error.issues[0];
}

describe('CreatePaymentLinkSchema — invoice creation payloads', () => {
  const base = {
    amount: 1500,
    currency: 'AUD',
    invoiceCurrency: 'AUD',
    description: 'Consulting services',
    invoiceDate: new Date('2026-08-14T12:00:00.000Z').toISOString(),
    dueDate: new Date('2026-08-28T12:00:00.000Z').toISOString(),
    invoiceReference: 'INV-0042',
    customerName: 'Danielle Test',
    customerEmail: 'client@example.com',
    invoiceOnlyMode: false,
  };

  it('accepts Stripe-only Xero-connected style payload', () => {
    const result = parsePayload({ ...base, paymentMethod: 'STRIPE' });
    expect(result.success).toBe(true);
  });

  it('accepts EVM_WALLET without crypto fields', () => {
    const result = parsePayload({ ...base, paymentMethod: 'EVM_WALLET' });
    expect(result.success).toBe(true);
  });

  it('accepts WISE without extra schema fields (Wise checked post-parse)', () => {
    const result = parsePayload({ ...base, paymentMethod: 'WISE' });
    expect(result.success).toBe(true);
  });

  it.each([
    ['0412345678', '+61412345678'],
    ['0412 345 678', '+61412345678'],
    ['04 1234 5678', '+61412345678'],
    ['+61 412 345 678', '+61412345678'],
    ['+61412345678', '+61412345678'],
  ])('normalizes Australian phone %s → %s', (input, expected) => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      customerPhone: input,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerPhone).toBe(expected);
    }
  });

  it('rejects invalid Australian phone numbers', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      customerPhone: '041234567',
    });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['customerPhone']);
  });

  it('accepts empty phone', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      customerPhone: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerPhone).toBeUndefined();
    }
  });

  it('preserves non-Australian E.164 numbers', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      customerPhone: '+14155552671',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customerPhone).toBe('+14155552671');
    }
  });

  it('rejects invalid customer email', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      customerEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['customerEmail']);
  });

  it('rejects amount with more than 2 decimal places', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      amount: 100.001,
    });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['amount']);
  });

  it('rejects missing paymentMethod when not invoice-only or customer-choice', () => {
    const result = parsePayload({ ...base });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['paymentMethod']);
  });

  it('accepts customer choice without paymentMethod', () => {
    const result = parsePayload({ ...base, customerChoosesAtCheckout: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paymentMethod).toBeUndefined();
      expect(result.data.customerChoosesAtCheckout).toBe(true);
    }
  });

  it('accepts invoice-only without paymentMethod', () => {
    const result = parsePayload({ ...base, invoiceOnlyMode: true });
    expect(result.success).toBe(true);
  });

  it('rejects CRYPTO without network/address/currency', () => {
    const result = parsePayload({ ...base, paymentMethod: 'CRYPTO' });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['cryptoNetwork']);
  });

  it('accepts CRYPTO with required fields', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'CRYPTO',
      cryptoNetwork: 'ethereum',
      cryptoAddress: '0x1234567890123456789012345678901234567890',
      cryptoCurrency: 'USDC',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid currency code', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      currency: 'AU',
    });
    expect(result.success).toBe(false);
    expect(firstIssue(result)?.path).toEqual(['currency']);
  });

  it('accepts Xero-style invoice reference with prefix and digits', () => {
    const result = parsePayload({
      ...base,
      paymentMethod: 'STRIPE',
      invoiceReference: 'INV-2026-0042',
    });
    expect(result.success).toBe(true);
  });

  it('does not require settlement accounts or commercialTiming', () => {
    const result = parsePayload({ ...base, paymentMethod: 'STRIPE' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('commercialTiming');
    }
  });
});
