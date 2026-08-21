/**
 * Production authentication branding — source of truth for copy that must appear
 * in Google Auth Platform and Supabase Auth (SMTP + email templates).
 *
 * Auth emails are sent by Supabase Auth, not by the application Resend client.
 * Changing app templates does not brand magic-link, signup, or recovery mail.
 *
 * Google consent branding lives in Google Cloud for the OAuth client wired in
 * Supabase. Renaming the Supabase project does not change the consent screen.
 */

export const PRODUCTION_SUPABASE_PROJECT_REF = 'kjcqsdvwemxmzlwoqqmx';
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
export const PRODUCTION_GOOGLE_CLOUD_PROJECT_NUMBER = '952706406493';
export const PRODUCTION_GOOGLE_OAUTH_CLIENT_ID =
  '952706406493-ugss8oqo7pcrnb3s6ukonb17a5hoauqp.apps.googleusercontent.com';
export const PRODUCTION_GOOGLE_OAUTH_REDIRECT_URI = `${PRODUCTION_SUPABASE_URL}/auth/v1/callback`;

export const PROVVYPAY_AUTH_SENDER_NAME = 'Provvypay';
export const PROVVYPAY_AUTH_SENDER_EMAIL = 'auth@provvypay.com';
export const PROVVYPAY_AUTH_SENDER = `${PROVVYPAY_AUTH_SENDER_NAME} <${PROVVYPAY_AUTH_SENDER_EMAIL}>`;
export const PROVVYPAY_SUPPORT_EMAIL = 'support@provvypay.com';
export const PROVVYPAY_HOMEPAGE_URL = 'https://provvypay.com';
export const PROVVYPAY_PRIVACY_URL = 'https://provvypay.com/privacy';
export const PROVVYPAY_TERMS_URL = 'https://provvypay.com/terms';
export const PROVVYPAY_APP_ICON_PATH = '/provvypay-icon.svg';

export const GOOGLE_AUTH_PLATFORM_URL = `https://console.cloud.google.com/auth/branding?project=${PRODUCTION_GOOGLE_CLOUD_PROJECT_NUMBER}`;
export const GOOGLE_OAUTH_CLIENT_URL = `https://console.cloud.google.com/auth/clients?project=${PRODUCTION_GOOGLE_CLOUD_PROJECT_NUMBER}`;
export const SUPABASE_AUTH_PROVIDERS_URL = `https://supabase.com/dashboard/project/${PRODUCTION_SUPABASE_PROJECT_REF}/auth/providers`;
export const SUPABASE_AUTH_TEMPLATES_URL = `https://supabase.com/dashboard/project/${PRODUCTION_SUPABASE_PROJECT_REF}/auth/templates`;
export const SUPABASE_AUTH_SMTP_URL = `https://supabase.com/dashboard/project/${PRODUCTION_SUPABASE_PROJECT_REF}/auth/smtp`;
export const SUPABASE_AUTH_URL_CONFIG_URL = `https://supabase.com/dashboard/project/${PRODUCTION_SUPABASE_PROJECT_REF}/auth/url-configuration`;

/** Strings that must never appear in user-facing auth email copy. */
export const FORBIDDEN_AUTH_EMAIL_BRANDING = [
  'Supabase Auth',
  'Supabase',
  'supabase.co',
  PRODUCTION_SUPABASE_PROJECT_REF,
  'Your Magic Link',
  'Follow this link to login',
] as const;

export const SUPABASE_AUTH_EMAIL_SUBJECTS = {
  confirmation: 'Confirm your Provvypay account',
  magic_link: 'Sign in to Provvypay',
  invite: 'You are invited to Provvypay',
  recovery: 'Reset your Provvypay password',
  email_change: 'Confirm your new Provvypay email',
  reauthentication: '{{ .Token }} is your Provvypay verification code',
  password_changed_notification: 'Your Provvypay password was changed',
  email_changed_notification: 'Your Provvypay email address was changed',
  phone_changed_notification: 'Your Provvypay phone number was changed',
  identity_linked_notification: 'A sign-in method was added to your Provvypay account',
  identity_unlinked_notification: 'A sign-in method was removed from your Provvypay account',
  mfa_factor_enrolled_notification: 'A verification method was added to your Provvypay account',
  mfa_factor_unenrolled_notification: 'A verification method was removed from your Provvypay account',
} as const;

export const MAGIC_LINK_CONFIRMATION_PLACEHOLDER = '{{ .ConfirmationURL }}';
export const REAUTHENTICATION_TOKEN_PLACEHOLDER = '{{ .Token }}';

export function brandedAuthFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    PROVVYPAY_AUTH_SENDER
  );
}
