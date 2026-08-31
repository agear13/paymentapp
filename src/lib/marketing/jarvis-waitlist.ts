import { z } from 'zod';
import { turnstileTokenSchema } from '@/lib/auth/auth-api.shared';

export const JARVIS_WAITLIST_SOURCE = 'jarvis_campaign';
export const JARVIS_LANDING_PATH = '/jarvis';
export { PROVVY_TODAY_PATH } from '@/lib/marketing/provvy-today';

export const jarvisWaitlistEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const jarvisWaitlistBodySchema = z.object({
  email: jarvisWaitlistEmailSchema,
  consent: z.literal(true),
  turnstileToken: turnstileTokenSchema,
});

export const normalizeJarvisWaitlistEmail = (email: string): string =>
  email.trim().toLowerCase();
