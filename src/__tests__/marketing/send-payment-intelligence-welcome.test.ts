import { sendPaymentIntelligenceWelcomeEmail } from '@/lib/marketing/send-payment-intelligence-welcome.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/email/client', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/config/env', () => ({
  __esModule: true,
  default: {
    email: { isConfigured: true, from: 'Provvypay <noreply@provvypay.com>' },
    appUrl: 'https://provvypay.com',
  },
}));

import { prisma } from '@/lib/server/prisma';
import { sendEmail } from '@/lib/email/client';

const findUniqueMock = prisma.marketing_waitlist_signups.findUnique as jest.Mock;
const updateMock = prisma.marketing_waitlist_signups.update as jest.Mock;
const sendEmailMock = sendEmail as jest.Mock;

describe('sendPaymentIntelligenceWelcomeEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateMock.mockResolvedValue({});
    sendEmailMock.mockResolvedValue({ success: true, id: 'msg-1' });
  });

  it('sends the welcome email only once', async () => {
    findUniqueMock
      .mockResolvedValueOnce({
        id: 'signup-1',
        confirmation_email_sent_at: null,
        marketing_unsubscribed_at: null,
        converted_at: null,
      })
      .mockResolvedValueOnce({
        id: 'signup-1',
        confirmation_email_sent_at: new Date(),
        marketing_unsubscribed_at: null,
        converted_at: null,
      });

    const first = await sendPaymentIntelligenceWelcomeEmail({
      signupId: 'signup-1',
      to: 'ada@provvy.com',
    });
    const second = await sendPaymentIntelligenceWelcomeEmail({
      signupId: 'signup-1',
      to: 'ada@provvy.com',
    });

    expect(first).toEqual({ sent: true });
    expect(second).toEqual({ sent: false, skipped: true, reason: 'already_sent' });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('G: suppresses welcome email for opted-out subscribers', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'signup-1',
      confirmation_email_sent_at: null,
      marketing_unsubscribed_at: new Date(),
      converted_at: null,
    });

    const result = await sendPaymentIntelligenceWelcomeEmail({
      signupId: 'signup-1',
      to: 'ada@provvy.com',
    });

    expect(result).toEqual({ sent: false, skipped: true, reason: 'suppressed' });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('H: suppresses welcome email for converted subscribers', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'signup-1',
      confirmation_email_sent_at: null,
      marketing_unsubscribed_at: null,
      converted_at: new Date(),
    });

    const result = await sendPaymentIntelligenceWelcomeEmail({
      signupId: 'signup-1',
      to: 'ada@provvy.com',
    });

    expect(result).toEqual({ sent: false, skipped: true, reason: 'suppressed' });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('F: never sends a second confirmation when confirmation_email_sent_at is set', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'signup-1',
      confirmation_email_sent_at: new Date('2026-01-01'),
      marketing_unsubscribed_at: null,
      converted_at: null,
    });

    const result = await sendPaymentIntelligenceWelcomeEmail({
      signupId: 'signup-1',
      to: 'ada@provvy.com',
    });

    expect(result).toEqual({ sent: false, skipped: true, reason: 'already_sent' });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

});
