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

/** Client countdown default; the API returns the authoritative retryAfterSeconds. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

export const SIGNUP_CHECK_EMAIL_TITLE = 'Check your email';
export const SIGNUP_CHECK_EMAIL_BODY =
  "We've sent a verification link to your email address. Please click the link to verify your account and continue.";
export const SIGNUP_CHECK_EMAIL_MISSING_HINT =
  "Check your spam or junk folder. If you still can't find the email, you can request a new verification email.";
export const SIGNUP_CHECK_EMAIL_MISSING = `Can't find it? ${SIGNUP_CHECK_EMAIL_MISSING_HINT}`;
