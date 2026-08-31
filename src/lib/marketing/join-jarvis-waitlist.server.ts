import 'server-only';

import { prisma } from '@/lib/server/prisma';
import {
  JARVIS_LANDING_PATH,
  JARVIS_WAITLIST_SOURCE,
  normalizeJarvisWaitlistEmail,
} from '@/lib/marketing/jarvis-waitlist';
import { sendJarvisWaitlistWelcomeEmail } from '@/lib/marketing/send-jarvis-waitlist-welcome.server';

export type JoinJarvisWaitlistInput = {
  email: string;
  consent: true;
};

export type JoinJarvisWaitlistResult = {
  ok: true;
  signup: 'created' | 'existing';
};

export class JarvisWaitlistConsentError extends Error {
  constructor() {
    super('Consent is required.');
    this.name = 'JarvisWaitlistConsentError';
  }
}

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');

export const joinJarvisWaitlist = async (
  input: JoinJarvisWaitlistInput
): Promise<JoinJarvisWaitlistResult> => {
  if (input.consent !== true) {
    throw new JarvisWaitlistConsentError();
  }

  const email = normalizeJarvisWaitlistEmail(input.email);

  try {
    await prisma.marketing_waitlist_signups.create({
      data: {
        email,
        source: JARVIS_WAITLIST_SOURCE,
        landing_page: JARVIS_LANDING_PATH,
        privacy_acknowledged_at: new Date(),
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    return { ok: true, signup: 'existing' };
  }

  await sendJarvisWaitlistWelcomeEmail({ to: email });
  return { ok: true, signup: 'created' };
};
