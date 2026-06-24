/** Blocked disposable / throwaway email domains. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'grr.la',
  'sharklasers.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  '10minutemail.net',
  'yopmail.com',
  'throwaway.email',
  'getnada.com',
  'maildrop.cc',
  'trashmail.com',
  'fakeinbox.com',
  'dispostable.com',
  'mailnesia.com',
  'tempail.com',
  'emailondeck.com',
  'mintemail.com',
  'mytemp.email',
  'spamgourmet.com',
]);

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export const DISPOSABLE_EMAIL_MESSAGE =
  'Disposable email addresses are not allowed. Please use a permanent work or personal email.';
