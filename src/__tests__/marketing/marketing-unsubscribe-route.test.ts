import { NextRequest } from 'next/server';
import { GET } from '@/app/api/marketing/unsubscribe/route';
import { createMarketingUnsubscribeToken } from '@/lib/marketing/marketing-unsubscribe-token.server';

jest.mock('@/lib/marketing/marketing-unsubscribe.server', () => ({
  unsubscribeMarketingSubscriber: jest.fn(),
}));

import { unsubscribeMarketingSubscriber } from '@/lib/marketing/marketing-unsubscribe.server';

const unsubscribeMock = unsubscribeMarketingSubscriber as jest.Mock;

describe('GET /api/marketing/unsubscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success HTML for a valid token', async () => {
    unsubscribeMock.mockResolvedValue({ ok: true, alreadyUnsubscribed: false });
    const token = createMarketingUnsubscribeToken('signup-1');

    const response = await GET(
      new NextRequest(`http://localhost/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`)
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/unsubscribed from Provvy marketing emails/i);
  });

  it('returns 400 for missing token', async () => {
    const response = await GET(new NextRequest('http://localhost/api/marketing/unsubscribe'));
    expect(response.status).toBe(400);
    expect(unsubscribeMock).not.toHaveBeenCalled();
  });
});
