import { CALENDLY_CONSULTATION_URL } from '@/lib/config/calendly-consultation-url';

/** Customer-facing contact inbox. Do not use support@ — it is not an active inbox. */
export const PROVVY_SUPPORT_EMAIL = 'hello@provvypay.com';
export const PROVVY_INQUIRIES_EMAIL = 'hello@provvypay.com';
export const CANONICAL_LIFECYCLE_APP_URL = 'https://provvypay.com';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Recipient-facing lifecycle app origin.
 * Ignores empty and loopback NEXT_PUBLIC_APP_URL values so local .env.local
 * (http://localhost:3000) cannot leak into outbound email links.
 */
export function resolveLifecycleAppUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_APP_URL
): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return CANONICAL_LIFECYCLE_APP_URL;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (LOOPBACK_HOSTS.has(hostname)) {
      return CANONICAL_LIFECYCLE_APP_URL;
    }
    return url.origin;
  } catch {
    return CANONICAL_LIFECYCLE_APP_URL;
  }
}

export const PROVVY_APP_URL = resolveLifecycleAppUrl();
export const PROVVY_ADVISOR_URL = `${resolveLifecycleAppUrl()}/workspace/advisor`;
export const PROVVY_PRIVACY_URL = 'https://provvypay.com/privacy';
export const PROVVY_TERMS_URL = 'https://provvypay.com/terms';

export type LifecycleContactConfig = {
  supportEmail: string;
  inquiriesEmail: string;
  founderEmail: string | null;
  founderWhatsapp: string | null;
  helpdeskUrl: string | null;
  consultationUrl: string;
  discordInviteUrl: string | null;
  advisorUrl: string;
  appUrl: string;
  privacyUrl: string;
};

export function getLifecycleContactConfig(): LifecycleContactConfig {
  const appUrl = resolveLifecycleAppUrl();
  return {
    supportEmail: PROVVY_SUPPORT_EMAIL,
    inquiriesEmail: PROVVY_INQUIRIES_EMAIL,
    founderEmail: process.env.FOUNDER_EMAIL?.trim() || null,
    founderWhatsapp: process.env.FOUNDER_WHATSAPP?.trim() || null,
    helpdeskUrl: process.env.HELPDESK_URL?.trim() || null,
    consultationUrl: CALENDLY_CONSULTATION_URL,
    discordInviteUrl: process.env.DISCORD_INVITE_URL?.trim() || null,
    advisorUrl: `${appUrl}/workspace/advisor`,
    appUrl,
    privacyUrl: PROVVY_PRIVACY_URL,
  };
}

export type MissingContactChannel =
  | 'founder_email'
  | 'founder_whatsapp'
  | 'helpdesk_url'
  | 'discord_invite_url';

export function getMissingContactChannels(
  config: LifecycleContactConfig = getLifecycleContactConfig()
): MissingContactChannel[] {
  const missing: MissingContactChannel[] = [];
  if (!config.founderEmail) missing.push('founder_email');
  if (!config.founderWhatsapp) missing.push('founder_whatsapp');
  if (!config.helpdeskUrl) missing.push('helpdesk_url');
  if (!config.discordInviteUrl) missing.push('discord_invite_url');
  return missing;
}

/**
 * Resolves the canonical sender identity for lifecycle emails.
 * Defaults to 'Provvypay <noreply@provvypay.com>'.
 * Explicitly guards against using onboarding@resend.dev in production.
 */
export function getLifecycleSenderEmail(): string {
  const from = process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim();
  if (from) {
    if (process.env.NODE_ENV === 'production' && from.includes('onboarding@resend.dev')) {
      console.warn(
        '[Lifecycle Email] WARNING: onboarding@resend.dev configured in production. Falling back to Provvypay <noreply@provvypay.com>'
      );
      return 'Provvypay <noreply@provvypay.com>';
    }
    return from;
  }
  return 'Provvypay <noreply@provvypay.com>';
}
