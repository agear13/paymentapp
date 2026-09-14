import config from '@/lib/config/env';
import { requestWiseFlagshipQuote } from '@/lib/connected-intelligence/wise-quote-client';

describe('requestWiseFlagshipQuote', () => {
  const originalToken = process.env.WISE_API_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.WISE_API_TOKEN;
    else process.env.WISE_API_TOKEN = originalToken;
  });

  it('posts only to the Wise quote endpoint and never to transfer execution', async () => {
    process.env.WISE_API_TOKEN = 'test-token';
    const fetcher = jest.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'quote-1' }),
    }));

    const result = await requestWiseFlagshipQuote({
      profileId: '999',
      sourceCurrency: 'AUD',
      targetCurrency: 'IDR',
      sourceAmount: 10000,
      fetcher,
    });

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.wise.com/v3/profiles/999/quotes');
    expect(url).not.toContain('/transfers');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      sourceCurrency: 'AUD',
      targetCurrency: 'IDR',
      sourceAmount: 10000,
      rateType: 'FIXED',
    });
  });

  it('fails closed when platform credentials are missing', async () => {
    const previousToken = config.wise.apiToken;
    config.wise.apiToken = undefined;
    delete process.env.WISE_API_TOKEN;
    try {
      const result = await requestWiseFlagshipQuote({
        profileId: '999',
        sourceCurrency: 'AUD',
        targetCurrency: 'IDR',
        sourceAmount: 10000,
        fetcher: jest.fn(),
      });
      expect(result).toEqual({ ok: false, reason: 'missing_credentials' });
    } finally {
      config.wise.apiToken = previousToken;
    }
  });

  it('fails closed when the profile id is missing', async () => {
    process.env.WISE_API_TOKEN = 'test-token';
    const result = await requestWiseFlagshipQuote({
      profileId: '   ',
      sourceCurrency: 'AUD',
      targetCurrency: 'IDR',
      sourceAmount: 10000,
      fetcher: jest.fn(),
    });
    expect(result).toEqual({ ok: false, reason: 'missing_profile' });
  });
});
