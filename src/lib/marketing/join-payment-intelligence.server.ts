import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { loggers } from '@/lib/logger';
import { finalizePaymentIntelligenceSubscriber } from '@/lib/marketing/finalize-payment-intelligence-subscriber.server';
import {
  isMarketingSubscriberFinalizationIncomplete,
  type MarketingWaitlistSignupRecord,
} from '@/lib/marketing/marketing-subscriber-types';
import {
  PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
  normalizePaymentIntelligenceEmail,
  paymentIntelligenceLandingPage,
  type PaymentIntelligenceSubscribeContext,
} from '@/lib/marketing/payment-intelligence-subscribe';

export type JoinPaymentIntelligenceInput = {
  email: string;
  consent: true;
  context?: PaymentIntelligenceSubscribeContext;
};

export type JoinPaymentIntelligenceResult = {
  ok: true;
  signup: 'created' | 'existing';
  signupId?: string;
};

export class PaymentIntelligenceConsentError extends Error {
  constructor() {
    super('Consent is required.');
    this.name = 'PaymentIntelligenceConsentError';
  }
}

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');

function toSignupRecord(row: {
  id: string;
  email: string;
  source: string;
  landing_page: string | null;
  resend_contact_id: string | null;
  marketing_unsubscribed_at: Date | null;
  converted_at: Date | null;
  user_id: string | null;
  confirmation_email_sent_at: Date | null;
  subscriber_created_event_at: Date | null;
  subscriber_converted_event_at: Date | null;
}): MarketingWaitlistSignupRecord {
  return row;
}

export const joinPaymentIntelligence = async (
  input: JoinPaymentIntelligenceInput
): Promise<JoinPaymentIntelligenceResult> => {
  if (input.consent !== true) {
    throw new PaymentIntelligenceConsentError();
  }

  const email = normalizePaymentIntelligenceEmail(input.email);
  const landingPage = paymentIntelligenceLandingPage(input.context);

  try {
    const created = await prisma.marketing_waitlist_signups.create({
      data: {
        email,
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landing_page: landingPage,
        privacy_acknowledged_at: new Date(),
      },
    });

    const record = toSignupRecord(created);
    try {
      await finalizePaymentIntelligenceSubscriber(record);
    } catch (err) {
      loggers.api.warn('Payment Intelligence subscriber finalize failed open', {
        signupId: created.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return { ok: true, signup: 'created', signupId: created.id };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.marketing_waitlist_signups.findUnique({
      where: {
        email_source: {
          email,
          source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        },
      },
    });

    if (existing) {
      const record = toSignupRecord(existing);
      if (isMarketingSubscriberFinalizationIncomplete(record)) {
        try {
          await finalizePaymentIntelligenceSubscriber(record);
        } catch (err) {
          loggers.api.warn('Payment Intelligence subscriber finalize recovery failed open', {
            signupId: existing.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return { ok: true, signup: 'existing', signupId: existing?.id };
  }
};
