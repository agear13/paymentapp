jest.mock('@/lib/marketing/finalize-payment-intelligence-subscriber.server', () => ({
  finalizePaymentIntelligenceSubscriber: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import {
  PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
  PAYMENT_INTELLIGENCE_TOPICS,
  normalizePaymentIntelligenceEmail,
  paymentIntelligenceLandingPage,
  paymentIntelligenceSubscribeBodySchema,
  presentPaymentIntelligenceSubscribe,
} from '@/lib/marketing/payment-intelligence-subscribe';
import { finalizePaymentIntelligenceSubscriber } from '@/lib/marketing/finalize-payment-intelligence-subscriber.server';
import { joinPaymentIntelligence } from '@/lib/marketing/join-payment-intelligence.server';
import { prisma } from '@/lib/server/prisma';

const createMock = prisma.marketing_waitlist_signups.create as jest.Mock;
const finalizeMock = jest.mocked(finalizePaymentIntelligenceSubscriber);

describe('payment intelligence subscribe', () => {
  beforeEach(() => {
    createMock.mockReset();
    finalizeMock.mockReset();
  });

  it('presents public intelligence, not a newsletter', () => {
    const copy = presentPaymentIntelligenceSubscribe();
    expect(copy.heading).toBe('Payment Intelligence, in your inbox');
    expect(copy.lead).toMatch(/Payment rails change/);
    expect(copy.support).toMatch(/what they mean for your business/);
    expect(copy.topics.map((topic) => topic.id)).toEqual([
      'rail_updates',
      'routes_to_consider',
      'regulatory_changes',
      'business_impact',
    ]);
    expect(PAYMENT_INTELLIGENCE_TOPICS).toHaveLength(4);
    expect(JSON.stringify(copy)).not.toMatch(/newsletter|fintech news|marketing updates|company updates/i);
  });

  it('becomes corridor-aware after a public compare without claiming a connected business', () => {
    const copy = presentPaymentIntelligenceSubscribe({
      compared: true,
      origin: 'AU',
      destination: 'ID',
    });
    expect(copy.heading).toBe('Want payment intelligence for Australia → Indonesia?');
    expect(copy.lead).toMatch(/rail changes, alternative routes and regulatory developments/);
    expect(JSON.stringify(copy)).not.toMatch(/personalised|your cash|connected business/i);
    expect(paymentIntelligenceLandingPage({ compared: true, origin: 'AU', destination: 'ID' })).toBe(
      '/?corridor=AU-ID'
    );
  });

  it('stores email against the payment intelligence source and corridor context', async () => {
    createMock.mockResolvedValue({
      id: 's1',
      email: 'ada@provvy.com',
      source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
      landing_page: '/?corridor=AU-ID',
      resend_contact_id: null,
      marketing_unsubscribed_at: null,
      converted_at: null,
      user_id: null,
      confirmation_email_sent_at: null,
      subscriber_created_event_at: null,
      subscriber_converted_event_at: null,
    });
    await expect(
      joinPaymentIntelligence({
        email: '  Ada@Provvy.com ',
        consent: true,
        context: { compared: true, origin: 'AU', destination: 'ID' },
      })
    ).resolves.toEqual({ ok: true, signup: 'created', signupId: 's1' });
    expect(finalizeMock).toHaveBeenCalledTimes(1);
    expect(normalizePaymentIntelligenceEmail('  Ada@Provvy.com ')).toBe('ada@provvy.com');
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ada@provvy.com',
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landing_page: '/?corridor=AU-ID',
        privacy_acknowledged_at: expect.any(Date),
      }),
    });
    expect(createMock.mock.calls[0][0].data).not.toHaveProperty('referrer');
  });

  it('treats duplicate email+source as success without re-running finalize when already complete', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    (prisma.marketing_waitlist_signups.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      email: 'ada@provvy.com',
      source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
      landing_page: '/',
      resend_contact_id: 'contact-1',
      marketing_unsubscribed_at: null,
      converted_at: null,
      user_id: null,
      confirmation_email_sent_at: new Date('2026-01-01'),
      subscriber_created_event_at: new Date('2026-01-01'),
      subscriber_converted_event_at: null,
    });
    await expect(
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'existing', signupId: 's1' });
    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it('resumes finalize for duplicate email+source when side effects are incomplete', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    (prisma.marketing_waitlist_signups.findUnique as jest.Mock).mockResolvedValue({
      id: 's1',
      email: 'ada@provvy.com',
      source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
      landing_page: '/',
      resend_contact_id: null,
      marketing_unsubscribed_at: null,
      converted_at: null,
      user_id: null,
      confirmation_email_sent_at: null,
      subscriber_created_event_at: null,
      subscriber_converted_event_at: null,
    });
    await expect(
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'existing', signupId: 's1' });
    expect(finalizeMock).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid emails and missing consent', () => {
    expect(
      paymentIntelligenceSubscribeBodySchema.safeParse({ email: 'nope', consent: true }).success
    ).toBe(false);
    expect(
      paymentIntelligenceSubscribeBodySchema.safeParse({ email: 'ada@provvy.com' }).success
    ).toBe(false);
  });

  it('rethrows unexpected persistence errors', async () => {
    createMock.mockRejectedValue(new Error('db down'));
    await expect(
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true })
    ).rejects.toThrow('db down');
  });
});
