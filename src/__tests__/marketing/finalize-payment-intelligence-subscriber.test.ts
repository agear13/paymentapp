import { finalizePaymentIntelligenceSubscriber } from '@/lib/marketing/finalize-payment-intelligence-subscriber.server';
import { PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE } from '@/lib/marketing/payment-intelligence-subscribe';

jest.mock('@/lib/marketing/resend-contacts.server', () => ({
  upsertMarketingResendContact: jest.fn(),
}));

jest.mock('@/lib/marketing/resend-marketing-events.server', () => ({
  emitMarketingSubscriberCreatedEvent: jest.fn(),
}));

jest.mock('@/lib/marketing/send-payment-intelligence-welcome.server', () => ({
  sendPaymentIntelligenceWelcomeEmail: jest.fn(),
}));

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      update: jest.fn(),
    },
  },
}));

import { upsertMarketingResendContact } from '@/lib/marketing/resend-contacts.server';
import { emitMarketingSubscriberCreatedEvent } from '@/lib/marketing/resend-marketing-events.server';
import { sendPaymentIntelligenceWelcomeEmail } from '@/lib/marketing/send-payment-intelligence-welcome.server';
import { prisma } from '@/lib/server/prisma';

const upsertContactMock = jest.mocked(upsertMarketingResendContact);
const emitCreatedMock = jest.mocked(emitMarketingSubscriberCreatedEvent);
const sendWelcomeMock = jest.mocked(sendPaymentIntelligenceWelcomeEmail);
const updateMock = prisma.marketing_waitlist_signups.update as jest.Mock;

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

describe('finalizePaymentIntelligenceSubscriber recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upsertContactMock.mockResolvedValue({ success: true, contactId: 'contact-1' });
    emitCreatedMock.mockResolvedValue({ emitted: true });
    sendWelcomeMock.mockResolvedValue({ sent: true });
    updateMock.mockResolvedValue({});
  });

  it('B: reconciles only a missing Resend contact', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      resend_contact_id: null,
      subscriber_created_event_at: new Date('2026-01-01'),
      confirmation_email_sent_at: new Date('2026-01-01'),
    });

    expect(upsertContactMock).toHaveBeenCalledTimes(1);
    expect(emitCreatedMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });

  it('C: emits subscriber.created only when missing', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      resend_contact_id: 'contact-1',
      subscriber_created_event_at: null,
      confirmation_email_sent_at: new Date('2026-01-01'),
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).toHaveBeenCalledTimes(1);
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });

  it('D: sends confirmation only when missing', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      resend_contact_id: 'contact-1',
      subscriber_created_event_at: new Date('2026-01-01'),
      confirmation_email_sent_at: null,
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
  });

  it('E: completes all missing finalization steps', async () => {
    await finalizePaymentIntelligenceSubscriber(baseSignup);

    expect(upsertContactMock).toHaveBeenCalledTimes(1);
    expect(emitCreatedMock).toHaveBeenCalledTimes(1);
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
  });

  it('F: skips contact upsert when resend_contact_id is already set', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      resend_contact_id: 'contact-1',
      subscriber_created_event_at: new Date('2026-01-01'),
      confirmation_email_sent_at: null,
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
  });

  it('G: never sends confirmation for opted-out subscribers', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      marketing_unsubscribed_at: new Date('2026-01-01'),
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });

  it('H: never sends confirmation for converted subscribers', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      converted_at: new Date('2026-01-01'),
      user_id: 'user-1',
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });

  it('I: leaves failed side effects recoverable without marking success', async () => {
    upsertContactMock.mockResolvedValue({ success: false, error: 'resend unavailable' });
    emitCreatedMock.mockResolvedValue({ emitted: false, reason: 'provider_error' });
    sendWelcomeMock.mockResolvedValue({ sent: false, reason: 'provider_error' });

    await finalizePaymentIntelligenceSubscriber(baseSignup);

    expect(updateMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).toHaveBeenCalledTimes(1);
    expect(sendWelcomeMock).toHaveBeenCalledTimes(1);
  });

  it('A: does nothing when all finalization steps are already complete', async () => {
    await finalizePaymentIntelligenceSubscriber({
      ...baseSignup,
      resend_contact_id: 'contact-1',
      subscriber_created_event_at: new Date('2026-01-01'),
      confirmation_email_sent_at: new Date('2026-01-01'),
    });

    expect(upsertContactMock).not.toHaveBeenCalled();
    expect(emitCreatedMock).not.toHaveBeenCalled();
    expect(sendWelcomeMock).not.toHaveBeenCalled();
  });
});
