import type { User } from '@supabase/supabase-js';

/**
 * Returns true when the user has confirmed their email address.
 * OAuth and magic-link providers typically confirm email on first sign-in.
 */
export function isEmailVerified(user: Pick<User, 'email_confirmed_at' | 'app_metadata'>): boolean {
  if (user.email_confirmed_at) {
    return true;
  }

  const provider = user.app_metadata?.provider as string | undefined;
  if (provider && provider !== 'email') {
    return true;
  }

  return false;
}

export const VERIFY_EMAIL_PATH = '/auth/verify-email';

export const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  'Please verify your email address before continuing.';
