import 'server-only';

import { loggers } from '@/lib/logger';
import { isMarketingSubscriberActive } from '@/lib/marketing/marketing-subscriber-types';
import { emitMarketingSubscriberCreatedEvent } from '@/lib/marketing/resend-marketing-events.server';
import { upsertMarketingResendContact } from '@/lib/marketing/resend-contacts.server';
import { sendPaymentIntelligenceWelcomeEmail } from '@/lib/marketing/send-payment-intelligence-welcome.server';
import type { MarketingWaitlistSignupRecord } from '@/lib/marketing/marketing-subscriber-types';
import { prisma } from '@/lib/server/prisma';

/**
 * Side effects for a newly created Payment Intelligence subscriber.
 * Fail-open: persistence already succeeded before this runs.
 */
export async function finalizePaymentIntelligenceSubscriber(
  signup: MarketingWaitlistSignupRecord
): Promise<void> {
  if (!isMarketingSubscriberActive(signup)) {
    return;
  }

  if (!signup.resend_contact_id) {
    const contactResult = await upsertMarketingResendContact({
      email: signup.email,
      source: signup.source,
      landingPage: signup.landing_page,
    });

    if (contactResult.contactId) {
      try {
        await prisma.marketing_waitlist_signups.update({
          where: { id: signup.id },
          data: { resend_contact_id: contactResult.contactId },
        });
      } catch (err) {
        loggers.api.warn('Failed to persist Resend contact id for marketing signup', {
          signupId: signup.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (!contactResult.success && !contactResult.skipped) {
      loggers.api.warn('Resend contact upsert failed for Payment Intelligence subscriber', {
        signupId: signup.id,
        reason: contactResult.error ?? 'provider_error',
      });
    }
  }

  if (!signup.subscriber_created_event_at) {
    await emitMarketingSubscriberCreatedEvent({
      signupId: signup.id,
      email: signup.email,
      source: signup.source,
      landingPage: signup.landing_page,
    });
  }

  if (!signup.confirmation_email_sent_at) {
    await sendPaymentIntelligenceWelcomeEmail({
      signupId: signup.id,
      to: signup.email,
    });
  }
}
