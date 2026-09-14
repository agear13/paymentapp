import {
  emitMarketingSubscriberCreatedEvent,
  emitMarketingSubscriberConvertedEvent,
  MARKETING_SUBSCRIBER_CREATED_EVENT,
  MARKETING_SUBSCRIBER_CONVERTED_EVENT,
} from '@/lib/marketing/resend-marketing-events.server';
import { PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE } from '@/lib/marketing/payment-intelligence-subscribe';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/server/prisma';

const findUniqueMock = prisma.marketing_waitlist_signups.findUnique as jest.Mock;
const findFirstMock = prisma.marketing_waitlist_signups.findFirst as jest.Mock;
const updateMock = prisma.marketing_waitlist_signups.update as jest.Mock;
const updateManyMock = prisma.marketing_waitlist_signups.updateMany as jest.Mock;

describe('Resend marketing subscriber events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMock.mockResolvedValue({});
    updateManyMock.mockResolvedValue({ count: 1 });
  });

  it('emits marketing.subscriber.created only once', async () => {
    findUniqueMock
      .mockResolvedValueOnce({ subscriber_created_event_at: null })
      .mockResolvedValueOnce({ subscriber_created_event_at: new Date() });

    const sendEventFn = jest.fn().mockResolvedValue({ success: true });

    const first = await emitMarketingSubscriberCreatedEvent(
      {
        signupId: 'signup-1',
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landingPage: '/',
      },
      { sendEventFn }
    );
    const second = await emitMarketingSubscriberCreatedEvent(
      {
        signupId: 'signup-1',
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landingPage: '/',
      },
      { sendEventFn }
    );

    expect(first).toEqual({ emitted: true });
    expect(second).toEqual({ emitted: false, reason: 'already_emitted' });
    expect(sendEventFn).toHaveBeenCalledTimes(1);
    expect(sendEventFn).toHaveBeenCalledWith({
      event: MARKETING_SUBSCRIBER_CREATED_EVENT,
      email: 'ada@provvy.com',
      payload: { source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE, landing_page: '/' },
    });
  });

  it('emits marketing.subscriber.converted only once per email', async () => {
    findFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'signup-1' });

    const sendEventFn = jest.fn().mockResolvedValue({ success: true });

    const first = await emitMarketingSubscriberConvertedEvent(
      { email: 'ada@provvy.com', source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE },
      { sendEventFn }
    );
    const second = await emitMarketingSubscriberConvertedEvent(
      { email: 'ada@provvy.com', source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE },
      { sendEventFn }
    );

    expect(first).toEqual({ emitted: true });
    expect(second).toEqual({ emitted: false, reason: 'already_emitted' });
    expect(sendEventFn).toHaveBeenCalledWith({
      event: MARKETING_SUBSCRIBER_CONVERTED_EVENT,
      email: 'ada@provvy.com',
      payload: { source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE },
    });
  });

  it('I: fails open when the provider returns an error without setting timestamp', async () => {
    findUniqueMock.mockResolvedValue({ subscriber_created_event_at: null });

    const result = await emitMarketingSubscriberCreatedEvent(
      {
        signupId: 'signup-1',
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
      },
      { sendEventFn: async () => ({ success: false, error: 'resend unavailable' }) }
    );

    expect(result.emitted).toBe(false);
    expect(result.reason).toBe('provider_error');
    expect(updateMock).not.toHaveBeenCalled();
  });

});
