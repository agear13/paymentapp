import 'server-only';

import { log } from '@/lib/logger';
import { isMarketingSubscriberActive } from '@/lib/marketing/marketing-subscriber-types';
import { emitMarketingSubscriberConvertedEvent } from '@/lib/marketing/resend-marketing-events.server';
import { prisma } from '@/lib/server/prisma';

export type ConvertMarketingSubscribersInput = {
  userId: string;
  email: string;
};

export type ConvertMarketingSubscribersResult = {
  convertedCount: number;
  convertedEventEmitted: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Links website subscriber records to a new Provvy account and stops subscriber nurture.
 * Fails open — must not block auth/onboarding.
 */
export async function convertMarketingSubscribersForUser(
  input: ConvertMarketingSubscribersInput
): Promise<ConvertMarketingSubscribersResult> {
  try {
    const email = normalizeEmail(input.email);
    if (!email || !email.includes('@') || !input.userId) {
      return { convertedCount: 0, convertedEventEmitted: false };
    }

    const signups = await prisma.marketing_waitlist_signups.findMany({
      where: { email },
    });

    if (signups.length === 0) {
      return { convertedCount: 0, convertedEventEmitted: false };
    }

    const now = new Date();
    let convertedCount = 0;

    for (const signup of signups) {
      if (signup.converted_at) continue;

      await prisma.marketing_waitlist_signups.update({
        where: { id: signup.id },
        data: {
          converted_at: now,
          user_id: input.userId,
        },
      });
      convertedCount += 1;
    }

    const shouldEmitConvertedEvent = signups.some(
      (signup) =>
        signup.subscriber_created_event_at &&
        isMarketingSubscriberActive(signup) &&
        !signup.subscriber_converted_event_at
    );

    let convertedEventEmitted = false;
    if (shouldEmitConvertedEvent) {
      const result = await emitMarketingSubscriberConvertedEvent({
        email,
        source: signups.find((s) => s.subscriber_created_event_at)?.source ?? null,
      });
      convertedEventEmitted = result.emitted;
    }

    return { convertedCount, convertedEventEmitted };
  } catch (err) {
    log.warn('convertMarketingSubscribersForUser failed open', {
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { convertedCount: 0, convertedEventEmitted: false };
  }
}
