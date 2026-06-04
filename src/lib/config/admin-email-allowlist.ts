/**
 * B5 C4: Single resolved admin email allowlist for server authorization.
 *
 * Authoritative: ADMIN_EMAIL_ALLOWLIST
 * Deprecated:    ADMIN_EMAILS (merged when allowlist empty; union when both set)
 */

let loggedDeprecatedAdminEmails = false;

function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
   .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve admin emails from environment.
 * Prefer ADMIN_EMAIL_ALLOWLIST; always union ADMIN_EMAILS for backward compatibility.
 */
export function resolveAdminEmailAllowlist(env: {
  ADMIN_EMAIL_ALLOWLIST?: string;
  ADMIN_EMAILS?: string;
}): string[] {
  const fromAllowlist = parseEmailList(env.ADMIN_EMAIL_ALLOWLIST);
  const fromLegacy = parseEmailList(env.ADMIN_EMAILS);

  if (fromLegacy.length > 0 && fromAllowlist.length === 0 && !loggedDeprecatedAdminEmails) {
    loggedDeprecatedAdminEmails = true;
    console.warn(
      '[env] ADMIN_EMAILS is deprecated; set ADMIN_EMAIL_ALLOWLIST instead. ' +
        'ADMIN_EMAILS is still applied until removed.'
    );
  } else if (fromLegacy.length > 0 && fromAllowlist.length > 0 && !loggedDeprecatedAdminEmails) {
    loggedDeprecatedAdminEmails = true;
    console.warn(
      '[env] ADMIN_EMAILS is deprecated; use ADMIN_EMAIL_ALLOWLIST only. ' +
        'Both lists are merged for authorization.'
    );
  }

  return Array.from(new Set([...fromAllowlist, ...fromLegacy]));
}

export function isEmailInAdminAllowlist(
  email: string,
  allowlist: readonly string[]
): boolean {
  const normalized = email.trim().toLowerCase();
  return allowlist.includes(normalized);
}
