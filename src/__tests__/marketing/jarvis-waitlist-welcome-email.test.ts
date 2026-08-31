import { sendEmail } from '@/lib/email/client';
import { buildJarvisWaitlistWelcomeEmail } from '@/lib/email/templates/jarvis-waitlist-welcome';
import { sendJarvisWaitlistWelcomeEmail } from '@/lib/marketing/send-jarvis-waitlist-welcome.server';
import { loggers } from '@/lib/logger';

jest.mock('@/lib/email/client', () => ({
  sendEmail: jest.fn(),
}));

jest.mock('@/lib/config/env', () => ({
  __esModule: true,
  default: {
    appUrl: 'https://app.example.com',
    email: { isConfigured: true, from: 'Provvy <noreply@provvypay.com>' },
  },
}));

jest.mock('@/lib/logger', () => ({
  loggers: {
    api: {
      warn: jest.fn(),
      info: jest.fn(),
    },
  },
}));

const sendEmailMock = sendEmail as jest.MockedFunction<typeof sendEmail>;
const warnMock = loggers.api.warn as jest.Mock;

describe('Jarvis waitlist welcome email', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    warnMock.mockReset();
  });

  it('includes the Explore Provvy CTA to the existing public product page', () => {
    const email = buildJarvisWaitlistWelcomeEmail({
      exploreUrl: 'https://app.example.com/journey',
      privacyUrl: 'https://app.example.com/privacy',
    });
    expect(email.subject).toBe("You're on the list for Provvy Jarvis.");
    expect(email.html).toContain("You're on the list. Here's where Provvy is going next");
    expect(email.html).toContain('Explore Provvy →');
    expect(email.html).toContain('href="https://app.example.com/journey"');
    expect(email.html).toContain('background-color:#7C5CFF');
    expect(email.html).toContain('href="https://app.example.com/privacy"');
    expect(email.html).toContain(
      "You're receiving this because you joined the Provvy Jarvis early-access waitlist."
    );
    expect(email.text).toContain('Explore Provvy → https://app.example.com/journey');
    expect(email.text).toContain('Privacy Policy: https://app.example.com/privacy');
    expect(email.html).not.toMatch(/ada@/);
  });

  it('sends through the existing Resend client without logging the recipient', async () => {
    sendEmailMock.mockResolvedValue({ id: 'msg_1', success: true });
    await expect(sendJarvisWaitlistWelcomeEmail({ to: 'ada@provvy.com' })).resolves.toEqual({
      sent: true,
    });
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ada@provvy.com',
        subject: "You're on the list for Provvy Jarvis.",
        tags: [{ name: 'category', value: 'jarvis-waitlist-welcome' }],
      })
    );
    expect(JSON.stringify(warnMock.mock.calls)).not.toContain('ada@provvy.com');
  });

  it('fails open and does not log the email address', async () => {
    sendEmailMock.mockResolvedValue({ id: '', success: false, error: 'provider down' });
    await expect(sendJarvisWaitlistWelcomeEmail({ to: 'ada@provvy.com' })).resolves.toEqual({
      sent: false,
    });
    expect(warnMock).toHaveBeenCalledWith('Jarvis waitlist welcome email failed', {
      reason: 'provider down',
    });
    expect(JSON.stringify(warnMock.mock.calls)).not.toContain('ada@provvy.com');
  });
});
