/**
 * Admin Authorization - Shared/Client-Safe Helpers
 * 
 * This module contains ONLY pure functions and constants that can be safely
 * imported by both server and client components. NO server-only imports here.
 */

/**
 * Beta lockdown admin emails - hardcoded for safety
 * Only these accounts can see Revenue Share and Platform Preview features
 */
export const BETA_ADMIN_EMAILS = ['alishajayne13@gmail.com'] as const;

/**
 * Check if an email is a beta admin (case-insensitive)
 * Used for feature gating during beta testing
 * 
 * This is a pure function - safe for client components
 */
export function isBetaAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BETA_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === normalized);
}

/**
 * Require beta admin access or throw 403 error
 * Use this in API routes that should be restricted during beta
 * 
 * This is a pure function - safe for client components
 */
export function requireBetaAdminOrThrow(sessionUserEmail?: string | null): void {
  if (!isBetaAdminEmail(sessionUserEmail)) {
    const error = new Error('Forbidden: Beta admin access required');
    (error as any).status = 403;
    throw error;
  }
}
