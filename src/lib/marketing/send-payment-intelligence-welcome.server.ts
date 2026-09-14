import 'server-only';

import config from '@/lib/config/env';
import { getLifecycleSenderEmail, resolveLifecycleAppUrl } from '@/lib/email/lifecycle/contact-config';
import { sendEmail } from '@/lib/email/client';
import { loggers } from '@/lib/logger';
import { buildMarketingUnsubscribeUrl } from '@/lib/marketing/marketing-unsubscribe-token.server';
import { isMarketingSubscriberActive } from '@/lib/marketing/marketing-subscriber-types';
import { buildPaymentIntelligenceWelcomeEmail } from '@/lib/marketing/payment-intelligence-welcome-template';
import { prisma } from '@/lib/server/prisma';

export type PaymentIntelligenceWelcomeEmailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
};

/**
 * Best-effort confirmation email for Payment Intelligence subscribers.
 * Never throws — waitlist persistence must stay successful.
 */
export async function sendPaymentIntelligenceWelcomeEmail(input: {
  signupId: string;
  to: string;
}): Promise<PaymentIntelligenceWelcomeEmailResult> {
  try {
    const signup = await prisma.marketing_waitlist_signups.findUnique({
      where: { id: input.signupId },
      select: {
        id: true,
        confirmation_email_sent_at: true,
        marketing_unsubscribed_at: true,
        converted_at: true,
      },
    });

    if (!signup) {
      return { sent: false, skipped: true, reason: 'signup_not_found' };
    }

    if (signup.confirmation_email_sent_at) {
      return { sent: false, skipped: true, reason: 'already_sent' };
    }

    if (!isMarketingSubscriberActive(signup)) {
      return { sent: false, skipped: true, reason: 'suppressed' };
    }

    if (!config.email.isConfigured) {
      loggers.api.warn('Payment Intelligence welcome email skipped', { reason: 'not_configured' });
      return { sent: false, skipped: true, reason: 'not_configured' };
    }

    const appUrl = resolveLifecycleAppUrl();
    const built = buildPaymentIntelligenceWelcomeEmail({
      unsubscribeUrl: buildMarketingUnsubscribeUrl(input.signupId, appUrl),
      signupUrl: `${appUrl}/auth/signup`,
    });

    const result = await sendEmail({
      to: input.to,
      from: getLifecycleSenderEmail(),
      subject: built.subject,
      html: built.html,
      text: built.text,
      tags: [{ name: 'category', value: 'payment-intelligence-welcome' }],
    });

    if (!result.success) {
      loggers.api.warn('Payment Intelligence welcome email failed', {
        reason: result.error ?? 'provider_error',
      });
      return { sent: false, reason: result.error ?? 'provider_error' };
    }

    await prisma.marketing_waitlist_signups.update({
      where: { id: input.signupId },
      data: { confirmation_email_sent_at: new Date() },
    });

    return { sent: true };
  } catch (error) {
    loggers.api.warn('Payment Intelligence welcome email failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return { sent: false, reason: error instanceof Error ? error.message : 'unknown' };
  }
}
