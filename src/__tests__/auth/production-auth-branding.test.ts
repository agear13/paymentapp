import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FORBIDDEN_AUTH_EMAIL_BRANDING,
  MAGIC_LINK_CONFIRMATION_PLACEHOLDER,
  PRODUCTION_GOOGLE_OAUTH_CLIENT_ID,
  PRODUCTION_GOOGLE_OAUTH_REDIRECT_URI,
  PRODUCTION_SUPABASE_PROJECT_REF,
  PROVVYPAY_AUTH_SENDER,
  PROVVYPAY_HOMEPAGE_URL,
  PROVVYPAY_PRIVACY_URL,
  PROVVYPAY_SUPPORT_EMAIL,
  PROVVYPAY_TERMS_URL,
  REAUTHENTICATION_TOKEN_PLACEHOLDER,
  SUPABASE_AUTH_EMAIL_SUBJECTS,
  brandedAuthFromAddress,
} from '@/lib/auth/production-auth-branding';
import { SUPABASE_AUTH_EMAIL_TEMPLATES } from '@/lib/auth/supabase-auth-email-templates';
import { buildParticipantMagicLinkRedirectTo } from '@/lib/participant-portal/participant-magic-link';

const TEMPLATES_DIR = join(__dirname, '../../../supabase/templates');

describe('production auth branding', () => {
  const templateNames = Object.keys(SUPABASE_AUTH_EMAIL_TEMPLATES) as Array<
    keyof typeof SUPABASE_AUTH_EMAIL_TEMPLATES
  >;

  it('keeps participant magic-link callbacks on /auth/callback with PKCE next path', () => {
    const origin = 'https://provvypay-api.onrender.com';
    const token = '9c1e725e-45fd-4456-bf45-db4d710addf4';
    expect(buildParticipantMagicLinkRedirectTo(origin, token)).toBe(
      `${origin}/auth/callback?next=${encodeURIComponent(`/participant/${token}`)}`
    );
  });

  it('identifies the live Google OAuth client used by the production Supabase project', () => {
    expect(PRODUCTION_GOOGLE_OAUTH_CLIENT_ID).toBe(
      '952706406493-ugss8oqo7pcrnb3s6ukonb17a5hoauqp.apps.googleusercontent.com'
    );
    expect(PRODUCTION_GOOGLE_OAUTH_REDIRECT_URI).toBe(
      `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co/auth/v1/callback`
    );
  });

  it('uses branded legal URLs and a Provvypay auth sender', () => {
    expect(PROVVYPAY_HOMEPAGE_URL).toBe('https://provvypay.com');
    expect(PROVVYPAY_PRIVACY_URL).toBe('https://provvypay.com/privacy');
    expect(PROVVYPAY_TERMS_URL).toBe('https://provvypay.com/terms');
    expect(PROVVYPAY_SUPPORT_EMAIL).toBe('support@provvypay.com');
    expect(PROVVYPAY_AUTH_SENDER).toBe('Provvypay <auth@provvypay.com>');
  });

  it('falls back to the branded Provvypay sender when env is unset', () => {
    const previousFrom = process.env.EMAIL_FROM;
    const previousResend = process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_FROM_EMAIL;
    try {
      expect(brandedAuthFromAddress()).toBe('Provvypay <auth@provvypay.com>');
    } finally {
      if (previousFrom === undefined) delete process.env.EMAIL_FROM;
      else process.env.EMAIL_FROM = previousFrom;
      if (previousResend === undefined) delete process.env.RESEND_FROM_EMAIL;
      else process.env.RESEND_FROM_EMAIL = previousResend;
    }
  });

  it('brands every auth subject as Provvypay and never mentions Supabase', () => {
    for (const [name, subject] of Object.entries(SUPABASE_AUTH_EMAIL_SUBJECTS)) {
      expect(subject.toLowerCase()).toContain('provvypay');
      for (const forbidden of FORBIDDEN_AUTH_EMAIL_BRANDING) {
        if (forbidden === 'Your Magic Link' || forbidden === 'Follow this link to login') continue;
        expect(subject.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
      expect(name).toBeTruthy();
    }
  });

  it('writes dashboard-ready HTML that matches the in-repo templates', () => {
    for (const name of templateNames) {
      const disk = readFileSync(join(TEMPLATES_DIR, `${name}.html`), 'utf8');
      expect(disk).toBe(SUPABASE_AUTH_EMAIL_TEMPLATES[name]);
    }
    expect(JSON.parse(readFileSync(join(TEMPLATES_DIR, 'subjects.json'), 'utf8'))).toEqual(
      SUPABASE_AUTH_EMAIL_SUBJECTS
    );
  });

  it('preserves the Supabase ConfirmationURL for link emails so PKCE/session is unchanged', () => {
    const linkTemplates = ['confirmation', 'magic_link', 'invite', 'recovery', 'email_change'] as const;
    for (const name of linkTemplates) {
      const html = SUPABASE_AUTH_EMAIL_TEMPLATES[name];
      expect(html).toContain(`href="${MAGIC_LINK_CONFIRMATION_PLACEHOLDER}"`);
      expect(html).not.toContain('{{ .TokenHash }}');
      expect(html).not.toContain('{{ .SiteURL }}');
      expect(html).not.toContain('{{ .RedirectTo }}');
    }
  });

  it('replaces the generic magic-link copy with branded Provvypay sign-in copy', () => {
    const html = SUPABASE_AUTH_EMAIL_TEMPLATES.magic_link;
    expect(html).toContain('Sign in to Provvypay');
    expect(html).toContain('Use this secure link to sign in to your Provvypay workspace');
    expect(html).not.toContain('Your Magic Link');
    expect(html).not.toContain('Follow this link to login');
    expect(html).not.toContain('Magic Link');
  });

  it('uses the reauthentication token, not a reconstructed callback URL', () => {
    const html = SUPABASE_AUTH_EMAIL_TEMPLATES.reauthentication;
    expect(html).toContain(REAUTHENTICATION_TOKEN_PLACEHOLDER);
    expect(html).not.toContain(MAGIC_LINK_CONFIRMATION_PLACEHOLDER);
  });

  it('keeps all user-visible template copy free of Supabase and project references', () => {
    for (const name of templateNames) {
      const html = SUPABASE_AUTH_EMAIL_TEMPLATES[name];
      expect(html).toContain('Provvypay');
      for (const forbidden of FORBIDDEN_AUTH_EMAIL_BRANDING) {
        if (forbidden === 'Your Magic Link' || forbidden === 'Follow this link to login') {
          expect(html).not.toContain(forbidden);
          continue;
        }
        expect(html.toLowerCase()).not.toContain(forbidden.toLowerCase());
      }
    }
  });
});
