import { unsubscribeMarketingSubscriber } from '@/lib/marketing/marketing-unsubscribe.server';
import { createMarketingUnsubscribeToken } from '@/lib/marketing/marketing-unsubscribe-token.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/marketing/resend-contacts.server', () => ({
  unsubscribeMarketingResendContact: jest.fn(),
}));

import { prisma } from '@/lib/server/prisma';
import { unsubscribeMarketingResendContact } from '@/lib/marketing/resend-contacts.server';

const findUniqueMock = prisma.marketing_waitlist_signups.findUnique as jest.Mock;
const updateManyMock = prisma.marketing_waitlist_signups.updateMany as jest.Mock;
const unsubscribeContactMock = unsubscribeMarketingResendContact as jest.Mock;

describe('unsubscribeMarketingSubscriber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeContactMock.mockResolvedValue({ success: true });
    updateManyMock.mockResolvedValue({ count: 1 });
  });

  it('unsubscribes a subscriber and syncs Resend contact state', async () => {
    const token = createMarketingUnsubscribeToken('signup-1');
    findUniqueMock.mockResolvedValue({
      id: 'signup-1',
      email: 'ada@provvy.com',
      marketing_unsubscribed_at: null,
    });

    const result = await unsubscribeMarketingSubscriber(token);

    expect(result).toEqual({ ok: true, alreadyUnsubscribed: false });
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { email: 'ada@provvy.com' },
      data: { marketing_unsubscribed_at: expect.any(Date) },
    });
    expect(unsubscribeContactMock).toHaveBeenCalledWith('ada@provvy.com');
  });

  it('rejects invalid tokens', async () => {
    const result = await unsubscribeMarketingSubscriber('not-a-valid-token');
    expect(result).toEqual({ ok: false, reason: 'invalid_token' });
  });
});
