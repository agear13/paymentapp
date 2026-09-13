import {
  getMissingContactChannels,
  getLifecycleSenderEmail,
  getLifecycleContactConfig,
  resolveLifecycleAppUrl,
  CANONICAL_LIFECYCLE_APP_URL,
  PROVVY_SUPPORT_EMAIL,
  PROVVY_INQUIRIES_EMAIL,
  type LifecycleContactConfig,
} from '@/lib/email/lifecycle/contact-config';
import { buildWelcomeEmail } from '@/lib/email/lifecycle/templates/welcome-template';
import { buildCommunityInviteEmail } from '@/lib/email/lifecycle/templates/community-template';
import { buildExistingUserCatchupEmail } from '@/lib/email/lifecycle/templates/existing-user-catchup-template';
import { buildActivationEmail } from '@/lib/email/lifecycle/activation-template';
import { buildAiAdvisorEmail } from '@/lib/email/lifecycle/templates/ai-advisor-template';
import { buildConsultationEmail } from '@/lib/email/lifecycle/templates/consultation-template';

describe('Lifecycle Contact & Channel Configuration', () => {
  const minimalConfig: LifecycleContactConfig = {
    supportEmail: 'hello@provvypay.com',
    inquiriesEmail: 'hello@provvypay.com',
    founderEmail: null,
    founderWhatsapp: null,
    helpdeskUrl: null,
    consultationUrl: 'https://calendly.com/alisha-provvypay/30min',
    discordInviteUrl: null,
    advisorUrl: 'https://provvypay.com/workspace/advisor',
    appUrl: 'https://provvypay.com',
    privacyUrl: 'https://provvypay.com/privacy',
  };

  it('correctly reports missing contact channels when not configured', () => {
    const missing = getMissingContactChannels(minimalConfig);
    expect(missing).toContain('founder_email');
    expect(missing).toContain('founder_whatsapp');
    expect(missing).toContain('helpdesk_url');
    expect(missing).toContain('discord_invite_url');
  });

  it('omits unconfigured Discord and WhatsApp from welcome email', () => {
    const email = buildWelcomeEmail({ contactConfig: minimalConfig });

    expect(email.html).not.toContain('Join the Provvy Discord');
    expect(email.text).not.toContain('Join the Provvy Discord');
    expect(email.html).not.toContain('WhatsApp:');
    expect(email.text).not.toContain('WhatsApp:');
    expect(email.html).not.toContain('Help Center:');
    expect(email.text).not.toContain('Help Center:');

    expect(email.html).toContain('https://calendly.com/alisha-provvypay/30min');
    expect(email.html).toContain('hello@provvypay.com');
    expect(email.html).not.toContain('support@provvypay.com');
  });

  it('includes Discord CTA when configured', () => {
    const configWithDiscord: LifecycleContactConfig = {
      ...minimalConfig,
      discordInviteUrl: 'https://discord.gg/provvy-test',
    };
    const email = buildWelcomeEmail({ contactConfig: configWithDiscord });

    expect(email.html).toContain('https://discord.gg/provvy-test');
    expect(email.text).toContain('https://discord.gg/provvy-test');
  });

  it('throws error when building community invite email without Discord configured', () => {
    expect(() => {
      buildCommunityInviteEmail({ contactConfig: minimalConfig });
    }).toThrow('Cannot build community invite email without configured DISCORD_INVITE_URL');
  });

  it('falls back to canonical domain when onboarding@resend.dev is supplied in production', () => {
    const oldEnv = process.env.NODE_ENV;
    const oldFrom = process.env.EMAIL_FROM;
    try {
      Object.assign(process.env, { NODE_ENV: 'production' });
      process.env.EMAIL_FROM = 'Provvypay <onboarding@resend.dev>';

      const sender = getLifecycleSenderEmail();
      expect(sender).toBe('Provvypay <noreply@provvypay.com>');
    } finally {
      Object.assign(process.env, { NODE_ENV: oldEnv });
      process.env.EMAIL_FROM = oldFrom;
    }
  });
});

describe('resolveLifecycleAppUrl', () => {
  it('maps localhost to https://provvypay.com', () => {
    expect(resolveLifecycleAppUrl('http://localhost:3000')).toBe(CANONICAL_LIFECYCLE_APP_URL);
    expect(resolveLifecycleAppUrl('http://localhost')).toBe(CANONICAL_LIFECYCLE_APP_URL);
  });

  it('maps 127.0.0.1 to https://provvypay.com', () => {
    expect(resolveLifecycleAppUrl('http://127.0.0.1:3000')).toBe(CANONICAL_LIFECYCLE_APP_URL);
    expect(resolveLifecycleAppUrl('http://127.0.0.1')).toBe(CANONICAL_LIFECYCLE_APP_URL);
  });

  it('maps ::1 to https://provvypay.com', () => {
    expect(resolveLifecycleAppUrl('http://[::1]:3000')).toBe(CANONICAL_LIFECYCLE_APP_URL);
    expect(resolveLifecycleAppUrl('http://[::1]')).toBe(CANONICAL_LIFECYCLE_APP_URL);
  });

  it('keeps a valid production URL unchanged', () => {
    expect(resolveLifecycleAppUrl('https://provvypay.com')).toBe('https://provvypay.com');
    expect(resolveLifecycleAppUrl('https://provvypay.com/')).toBe('https://provvypay.com');
  });

  it('falls back when the configured URL is empty', () => {
    expect(resolveLifecycleAppUrl('')).toBe(CANONICAL_LIFECYCLE_APP_URL);
    expect(resolveLifecycleAppUrl(undefined)).toBe(CANONICAL_LIFECYCLE_APP_URL);
    expect(resolveLifecycleAppUrl('   ')).toBe(CANONICAL_LIFECYCLE_APP_URL);
  });
});

describe('getLifecycleContactConfig recipient-facing defaults', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it('uses hello@provvypay.com and never support@provvypay.com', () => {
    const config = getLifecycleContactConfig();
    expect(config.supportEmail).toBe('hello@provvypay.com');
    expect(config.inquiriesEmail).toBe('hello@provvypay.com');
    expect(PROVVY_SUPPORT_EMAIL).toBe('hello@provvypay.com');
    expect(PROVVY_INQUIRIES_EMAIL).toBe('hello@provvypay.com');
    expect(JSON.stringify(config)).not.toContain('support@provvypay.com');
  });

  it('rejects NEXT_PUBLIC_APP_URL=localhost for appUrl and advisorUrl', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    const config = getLifecycleContactConfig();
    expect(config.appUrl).toBe('https://provvypay.com');
    expect(config.advisorUrl).toBe('https://provvypay.com/workspace/advisor');
    expect(config.appUrl).not.toMatch(/localhost|127\.0\.0\.1|::1/);
    expect(config.advisorUrl).not.toMatch(/localhost|127\.0\.0\.1|::1/);
  });

  it('preserves the consultation URL', () => {
    expect(getLifecycleContactConfig().consultationUrl).toBe(
      'https://calendly.com/alisha-provvypay/30min'
    );
  });
});

describe('lifecycle emails cannot render loopback or support@', () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
  });

  it('renders no loopback URL or support@ when NEXT_PUBLIC_APP_URL is localhost', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

    const emails = [
      buildWelcomeEmail(),
      buildExistingUserCatchupEmail(),
      buildActivationEmail(),
      buildAiAdvisorEmail(),
      buildConsultationEmail(),
    ];

    for (const email of emails) {
      expect(email.html).not.toMatch(/localhost|127\.0\.0\.1|::1/);
      expect(email.text).not.toMatch(/localhost|127\.0\.0\.1|::1/);
      expect(email.html).toContain('https://provvypay.com');
      expect(email.html).toContain('hello@provvypay.com');
      expect(email.html).not.toContain('support@provvypay.com');
      expect(email.text).not.toContain('support@provvypay.com');
    }
  });
});
