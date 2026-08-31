import { jarvisWaitlistBodySchema, normalizeJarvisWaitlistEmail } from '@/lib/marketing/jarvis-waitlist';
import { joinJarvisWaitlist } from '@/lib/marketing/join-jarvis-waitlist.server';
import { sendJarvisWaitlistWelcomeEmail } from '@/lib/marketing/send-jarvis-waitlist-welcome.server';

jest.mock('@/lib/server/prisma', () => ({
  prisma: {
    marketing_waitlist_signups: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/marketing/send-jarvis-waitlist-welcome.server', () => ({
  sendJarvisWaitlistWelcomeEmail: jest.fn(),
}));

import { prisma } from '@/lib/server/prisma';

const createMock = prisma.marketing_waitlist_signups.create as jest.Mock;
const welcomeMock = sendJarvisWaitlistWelcomeEmail as jest.MockedFunction<
  typeof sendJarvisWaitlistWelcomeEmail
>;

describe('jarvis waitlist', () => {
  beforeEach(() => {
    createMock.mockReset();
    welcomeMock.mockReset();
    welcomeMock.mockResolvedValue({ sent: true });
  });

  it('normalizes email for storage', () => {
    expect(normalizeJarvisWaitlistEmail('  Ada@Provvy.com ')).toBe('ada@provvy.com');
    expect(
      jarvisWaitlistBodySchema.parse({ email: '  Ada@Provvy.com ', consent: true })
    ).toEqual({
      email: 'ada@provvy.com',
      consent: true,
    });
  });

  it('rejects invalid emails', () => {
    expect(
      jarvisWaitlistBodySchema.safeParse({ email: 'not-an-email', consent: true }).success
    ).toBe(false);
  });

  it('rejects missing consent', () => {
    expect(jarvisWaitlistBodySchema.safeParse({ email: 'ada@provvy.com' }).success).toBe(
      false
    );
    expect(
      jarvisWaitlistBodySchema.safeParse({ email: 'ada@provvy.com', consent: false }).success
    ).toBe(false);
  });

  it('creates a consented jarvis_campaign signup and sends a welcome email', async () => {
    createMock.mockResolvedValue({ id: 'w1' });
    await expect(
      joinJarvisWaitlist({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'created' });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ada@provvy.com',
        source: 'jarvis_campaign',
        landing_page: '/jarvis',
        privacy_acknowledged_at: expect.any(Date),
      }),
    });
    expect(createMock.mock.calls[0][0].data).not.toHaveProperty('referrer');
    expect(welcomeMock).toHaveBeenCalledWith({ to: 'ada@provvy.com' });
  });

  it('does not persist when consent is missing', async () => {
    await expect(
      joinJarvisWaitlist({ email: 'ada@provvy.com', consent: false as unknown as true })
    ).rejects.toThrow('Consent is required.');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('treats duplicate email+source as success', async () => {
    createMock.mockRejectedValue({ code: 'P2002' });
    await expect(
      joinJarvisWaitlist({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'existing' });
    expect(welcomeMock).not.toHaveBeenCalled();
  });

  it('still succeeds when the welcome email fails', async () => {
    createMock.mockResolvedValue({ id: 'w1' });
    welcomeMock.mockResolvedValue({ sent: false });
    await expect(
      joinJarvisWaitlist({ email: 'ada@provvy.com', consent: true })
    ).resolves.toEqual({ ok: true, signup: 'created' });
  });

  it('rethrows unexpected persistence errors', async () => {
    createMock.mockRejectedValue(new Error('db down'));
    await expect(
      joinJarvisWaitlist({ email: 'ada@provvy.com', consent: true })
    ).rejects.toThrow('db down');
  });
});
