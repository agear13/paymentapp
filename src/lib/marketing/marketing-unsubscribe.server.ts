import 'server-only';

import { loggers } from '@/lib/logger';
import { verifyMarketingUnsubscribeToken } from '@/lib/marketing/marketing-unsubscribe-token.server';
import { unsubscribeMarketingResendContact } from '@/lib/marketing/resend-contacts.server';
import { prisma } from '@/lib/server/prisma';

export type MarketingUnsubscribeResult =
  | { ok: true; alreadyUnsubscribed: boolean }
  | { ok: false; reason: 'invalid_token' | 'not_found' };

export async function unsubscribeMarketingSubscriber(token: string): Promise<MarketingUnsubscribeResult> {
  const verified = verifyMarketingUnsubscribeToken(token);
  if (!verified) {
    return { ok: false, reason: 'invalid_token' };
  }

  const signup = await prisma.marketing_waitlist_signups.findUnique({
    where: { id: verified.signupId },
    select: {
      id: true,
      email: true,
      marketing_unsubscribed_at: true,
    },
  });

  if (!signup) {
    return { ok: false, reason: 'not_found' };
  }

  if (signup.marketing_unsubscribed_at) {
    return { ok: true, alreadyUnsubscribed: true };
  }

  await prisma.marketing_waitlist_signups.updateMany({
    where: { email: signup.email },
    data: { marketing_unsubscribed_at: new Date() },
  });

  const resendResult = await unsubscribeMarketingResendContact(signup.email);
  if (!resendResult.success && !resendResult.skipped) {
    loggers.api.warn('Marketing unsubscribe Resend sync failed', {
      reason: resendResult.error ?? 'provider_error',
    });
  }

  return { ok: true, alreadyUnsubscribed: false };
}
