/** Generic login message — never reveal whether an email exists. */
export const GENERIC_AUTH_FAILURE =
  'Invalid email or password. Please check your credentials and try again.';

export const GENERIC_SIGNUP_FAILURE =
  "We couldn't create your account. Please try again.";

export const ACCOUNT_EXISTS_MESSAGE =
  'An account already exists for this email. Sign in to continue.';

export const ACCOUNT_EXISTS_CODE = 'ACCOUNT_EXISTS';

export const GENERIC_RESET_RESPONSE =
  'If an account exists for that email, a password reset link has been sent.';

export const GENERIC_RATE_LIMIT =
  'Too many attempts. Please wait before trying again.';

export const AUTH_LOCKED_MESSAGE =
  'Too many failed sign-in attempts. Please try again later.';

const EXISTING_ACCOUNT_SIGNUP_CODES = new Set([
  'user_already_exists',
  'email_exists',
  'identity_already_exists',
]);

/**
 * Detect GoTrue/Supabase "email already registered" without exposing raw internals.
 */
export function isExistingAccountSignupError(error: {
  message?: string | null;
  code?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  const code = error.code?.trim().toLowerCase();
  if (code && EXISTING_ACCOUNT_SIGNUP_CODES.has(code)) return true;

  const message = error.message?.trim().toLowerCase();
  if (!message) return false;
  return message.includes('already registered') || message.includes('already been registered');
}
