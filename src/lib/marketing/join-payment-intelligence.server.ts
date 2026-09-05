import 'server-only';

import { prisma } from '@/lib/server/prisma';
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
};

export class PaymentIntelligenceConsentError extends Error {
  constructor() {
    super('Consent is required.');
    this.name = 'PaymentIntelligenceConsentError';
  }
}

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');

export const joinPaymentIntelligence = async (
  input: JoinPaymentIntelligenceInput
): Promise<JoinPaymentIntelligenceResult> => {
  if (input.consent !== true) {
    throw new PaymentIntelligenceConsentError();
  }

  const email = normalizePaymentIntelligenceEmail(input.email);

  try {
    await prisma.marketing_waitlist_signups.create({
      data: {
        email,
        source: PAYMENT_INTELLIGENCE_SUBSCRIBE_SOURCE,
        landing_page: paymentIntelligenceLandingPage(input.context),
        privacy_acknowledged_at: new Date(),
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    return { ok: true, signup: 'existing' };
  }

  return { ok: true, signup: 'created' };
};
