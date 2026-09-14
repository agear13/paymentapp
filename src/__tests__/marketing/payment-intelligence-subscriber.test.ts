import { joinPaymentIntelligence } from '@/lib/marketing/join-payment-intelligence.server';
import { PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE } from '@/lib/marketing/payment-intelligence-subscribe';
import { buildPaymentIntelligenceWelcomeEmail } from '@/lib/marketing/payment-intelligence-welcome-template';
import { convertMarketingSubscribersForUser } from '@/lib/marketing/marketing-subscriber-conversion.server';
import {
  createMarketingUnsubscribeToken,
  verifyMarketingUnsubscribeToken,
} from '@/lib/marketing/marketing-unsubscribe-token.server';
import { finalizePaymentIntelligenceSubscriber } from '@/lib/marketing/finalize-payment-intelligence-subscriber.server';
import { isMarketingSubscriberFinalizationIncomplete } from '@/lib/marketing/marketing-subscriber-types';

jest.mock('@/lib/marketing/finalize-payment-intelligence-subscriber.server', () => ({
  finalizePaymentIntelligenceSubscriber: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/marketing/resend-marketing-events.server', () => ({
  emitMarketingSubscriberConvertedEvent: jest.fn(),
}));

import { prisma } from '@/lib/server/prisma';
import { emitMarketingSubscriberConvertedEvent } from '@/lib/marketing/resend-marketing-events.server';

const createMock = prisma.marketing_waitlist_signups.create as jest.Mock;
const findUniqueMock = prisma.marketing_waitlist_signups.findUnique as jest.Mock;
const findManyMock = prisma.marketing_waitlist_signups.findMany as jest.Mock;
const updateMock = prisma.marketing_waitlist_signups.update as jest.Mock;
const finalizeMock = jest.mocked(finalizePaymentIntelligenceSubscriber);
const emitConvertedMock = jest.mocked(emitMarketingSubscriberConvertedEvent);

const baseSignup = {
  id: 'signup-1',
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
};

const fullyFinalizedSignup = {
  ...baseSignup,
  resend_contact_id: 'contact-1',
  subscriber_created_event_at: new Date('2026-01-01'),
  confirmation_email_sent_at: new Date('2026-01-01'),
};

describe('Payment Intelligence subscriber join flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    finalizeMock.mockResolvedValue(undefined);
    emitConvertedMock.mockResolvedValue({ emitted: true });
  });

  it('creates a subscriber and runs finalize side effects once', async () => {
    createMock.mockResolvedValue(baseSignup);

    const result = await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(result).toEqual({ ok: true, signup: 'created', signupId: 'signup-1' });
    expect(finalizeMock).toHaveBeenCalledWith(baseSignup);
  });

  it('A: treats a fully finalized duplicate subscription as success without re-running side effects', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue(fullyFinalizedSignup);

    const result = await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(result).toEqual({ ok: true, signup: 'existing', signupId: 'signup-1' });
    expect(finalizeMock).not.toHaveBeenCalled();
    expect(isMarketingSubscriberFinalizationIncomplete(fullyFinalizedSignup)).toBe(false);
  });

  it('E: resumes finalize when duplicate subscription has multiple missing side effects', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue(baseSignup);

    const result = await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(result).toEqual({ ok: true, signup: 'existing', signupId: 'signup-1' });
    expect(finalizeMock).toHaveBeenCalledWith(baseSignup);
  });

  it('B: resumes finalize for duplicate missing Resend contact only', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    const partial = {
      ...fullyFinalizedSignup,
      resend_contact_id: null,
    };
    findUniqueMock.mockResolvedValue(partial);

    await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(finalizeMock).toHaveBeenCalledWith(partial);
    expect(isMarketingSubscriberFinalizationIncomplete(partial)).toBe(true);
  });

  it('C: resumes finalize for duplicate missing subscriber.created event only', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    const partial = {
      ...fullyFinalizedSignup,
      subscriber_created_event_at: null,
    };
    findUniqueMock.mockResolvedValue(partial);

    await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(finalizeMock).toHaveBeenCalledWith(partial);
  });

  it('D: resumes finalize for duplicate missing confirmation email only', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    const partial = {
      ...fullyFinalizedSignup,
      confirmation_email_sent_at: null,
    };
    findUniqueMock.mockResolvedValue(partial);

    await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(finalizeMock).toHaveBeenCalledWith(partial);
  });

  it('G: does not resume finalize for opted-out duplicate subscribers', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue({
      ...baseSignup,
      marketing_unsubscribed_at: new Date('2026-01-01'),
    });

    await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it('H: does not resume finalize for converted duplicate subscribers', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue({
      ...baseSignup,
      converted_at: new Date('2026-01-01'),
      user_id: 'user-1',
    });

    await joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true });

    expect(finalizeMock).not.toHaveBeenCalled();
  });

  it('still succeeds when finalize side effects fail open', async () => {
    createMock.mockResolvedValue(baseSignup);
    finalizeMock.mockRejectedValue(new Error('resend down'));

    await expect(
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'created', signupId: 'signup-1' });
  });

  it('still succeeds when duplicate recovery finalize fails open', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue(baseSignup);
    finalizeMock.mockRejectedValue(new Error('resend down'));

    await expect(
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'existing', signupId: 'signup-1' });
  });

  it('J: concurrent duplicate requests both attempt recovery safely', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    findUniqueMock.mockResolvedValue(baseSignup);

    await Promise.all([
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true }),
      joinPaymentIntelligence({ email: 'ada@provvy.com', consent: true }),
    ]);

    expect(finalizeMock).toHaveBeenCalledTimes(2);
    expect(finalizeMock).toHaveBeenCalledWith(baseSignup);
  });

  it('converts matching subscriber records and emits converted event once', async () => {
    findManyMock.mockResolvedValue([
      { ...baseSignup, subscriber_created_event_at: new Date() },
      {
        ...baseSignup,
        id: 'signup-2',
        source: 'jarvis_campaign',
        subscriber_created_event_at: null,
      },
    ]);
    updateMock.mockResolvedValue({});

    const result = await convertMarketingSubscribersForUser({
      userId: 'user-1',
      email: 'ada@provvy.com',
    });

    expect(result).toEqual({ convertedCount: 2, convertedEventEmitted: true });
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(emitConvertedMock).toHaveBeenCalledWith({
      email: 'ada@provvy.com',
      source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
    });
  });

  it('renders payment intelligence welcome with unsubscribe and signup CTAs', () => {
    const email = buildPaymentIntelligenceWelcomeEmail({
      unsubscribeUrl: 'https://provvypay.com/api/marketing/unsubscribe?token=abc',
      signupUrl: 'https://provvypay.com/auth/signup',
    });

    expect(email.subject).toMatch(/Payment Intelligence/i);
    expect(email.html).toContain('https://provvypay.com/api/marketing/unsubscribe?token=abc');
    expect(email.html).toContain('https://provvypay.com/auth/signup');
    expect(email.html).toContain('subscribed to Provvy Payment Intelligence');
    expect(email.html).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('rejects tampered unsubscribe tokens', () => {
    const token = createMarketingUnsubscribeToken('signup-1');
    expect(verifyMarketingUnsubscribeToken(`${token}x`)).toBeNull();
  });
});
