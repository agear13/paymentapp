import { defaultCommercialDealDraft } from '@/lib/commercial-os/commercial-deal-draft';
import { createPaymentLinkFromDraft } from '@/lib/payment-links/create-payment-link-from-draft';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('createPaymentLinkFromDraft validation errors', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws the structured validation message from the API response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Validation error',
        details: [
          {
            field: 'customerPhone',
            message: 'Enter a valid phone number (e.g. 0412 345 678 or +61412345678).',
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const draft = {
      ...defaultCommercialDealDraft(),
      amount: 1500,
      currency: 'AUD',
      description: 'Consulting services',
      paymentMethod: 'STRIPE' as const,
      customerPhone: '041234567',
    };

    await expect(createPaymentLinkFromDraft(ORG_ID, draft)).rejects.toThrow(
      'Invoice could not be created: Enter a valid phone number (e.g. 0412 345 678 or +61412345678).'
    );
  });
});

describe('createPaymentLinkFromDraft Australian phone in request body', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends local Australian phone to API (server normalizes to E.164)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'pl-1', shortCode: 'abc123' },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const draft = {
      ...defaultCommercialDealDraft(),
      amount: 1500,
      currency: 'AUD',
      description: 'Consulting services',
      paymentMethod: 'STRIPE' as const,
      customerPhone: '0412 345 678',
    };

    await createPaymentLinkFromDraft(ORG_ID, draft);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { customerPhone?: string };
    expect(body.customerPhone).toBe('0412 345 678');
  });
});
