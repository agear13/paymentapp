import 'server-only';

import config from '@/lib/config/env';
import { sendEmail } from '@/lib/email/client';
import { buildJarvisWaitlistWelcomeEmail } from '@/lib/email/templates/jarvis-waitlist-welcome';
import { PROVVYPAY_PRIVACY_PATH } from '@/lib/legal/provvypay-legal-paths';
import { loggers } from '@/lib/logger';
import { PROVVY_TODAY_PATH } from '@/lib/marketing/provvy-today';

export type JarvisWelcomeEmailResult = {
  sent: boolean;
  skipped?: boolean;
};

const resolveExploreUrl = (): string => {
  const base = (config.appUrl || '').replace(/\/$/, '');
  return `${base}${PROVVY_TODAY_PATH}`;
};

/**
 * Best-effort welcome email. Never throws — waitlist persistence must stay successful.
 * Do not log the recipient address.
 */
export const sendJarvisWaitlistWelcomeEmail = async (input: {
  to: string;
}): Promise<JarvisWelcomeEmailResult> => {
  try {
    if (!config.email.isConfigured) {
      loggers.api.warn('Jarvis waitlist welcome email skipped', { reason: 'not_configured' });
      return { sent: false, skipped: true };
    }

    const built = buildJarvisWaitlistWelcomeEmail({
      exploreUrl: resolveExploreUrl(),
      privacyUrl: `${(config.appUrl || '').replace(/\/$/, '')}${PROVVYPAY_PRIVACY_PATH}`,
    });
    const result = await sendEmail({
      to: input.to,
      from: config.email.from,
      subject: built.subject,
      html: built.html,
      text: built.text,
      tags: [{ name: 'category', value: 'jarvis-waitlist-welcome' }],
    });

    if (!result.success) {
      loggers.api.warn('Jarvis waitlist welcome email failed', {
        reason: result.error ?? 'provider_error',
      });
      return { sent: false };
    }

    return { sent: true };
  } catch (error) {
    loggers.api.warn('Jarvis waitlist welcome email failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return { sent: false };
  }
};
