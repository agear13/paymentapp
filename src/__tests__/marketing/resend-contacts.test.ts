import { upsertMarketingResendContact } from '@/lib/marketing/resend-contacts.server';
import { PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE } from '@/lib/marketing/payment-intelligence-subscribe';

describe('upsertMarketingResendContact', () => {
  it('creates a contact via HTTP without sending email', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'contact-99' }),
    });

    const result = await upsertMarketingResendContact(
      {
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landingPage: '/',
      },
      {
        fetchFn,
        getApiKeyFn: () => 'test-key',
        getSegmentIdFn: () => 'segment-1',
      }
    );

    expect(result).toEqual({ success: true, contactId: 'contact-99' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.resend.com/contacts',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
    const body = JSON.parse(String(fetchFn.mock.calls[0][1].body));
    expect(body.segments).toEqual([{ id: 'segment-1' }]);
    expect(body.properties.source).toBe(PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE);
  });

  it('updates an existing contact on HTTP 409', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ message: 'already exists' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'contact-existing' }),
      });

    const result = await upsertMarketingResendContact(
      {
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
      },
      {
        fetchFn,
        getApiKeyFn: () => 'test-key',
      }
    );

    expect(result).toEqual({ success: true, contactId: 'contact-existing' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[1][0])).toContain('/contacts/ada%40provvy.com');
  });

  it('skips safely when RESEND_API_KEY is missing', async () => {
    const result = await upsertMarketingResendContact(
      { email: 'ada@provvy.com', source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE },
      { getApiKeyFn: () => undefined }
    );

    expect(result).toEqual({
      success: false,
      skipped: true,
      error: 'RESEND_API_KEY not set',
    });
  });
});
