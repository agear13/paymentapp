/**
 * Admin Authorization - Shared/Client-Safe Helpers
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CLIENT-SAFE MODULE                                                           ║
 * ║                                                                               ║
 * ║  This module contains ONLY pure functions and constants.                     ║
 * ║  It can be safely imported from both server and client components.           ║
 * ║                                                                               ║
 * ║  DO NOT add any imports from:                                                ║
 * ║    - next/headers                                                            ║
 * ║    - @/lib/supabase/server                                                   ║
 * ║    - Any module that uses cookies() or headers()                             ║
 * ║                                                                               ║
 * ║  For server-only auth checks, use: @/lib/auth/admin.server                   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
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
 * Product surface shown in the dashboard shell (computed server-side).
 */
export type DashboardProductProfile = 'admin' | 'standard' | 'rabbit_hole_pilot';

/**
 * Rabbit Hole Deal Network pilot — allowlist (case-insensitive).
 * Also supported: RABBIT_HOLE_PILOT_EMAILS (comma-separated) in env (e.g. on Render).
 */
export const RABBIT_HOLE_PILOT_EMAILS = ['jaynealisha77@gmail.com'] as const;

/**
 * True if this email is a Rabbit Hole pilot-only user (not beta admin).
 * Server code should also merge process.env.RABBIT_HOLE_PILOT_EMAILS — see dashboard-product.server.ts.
 */
export function isRabbitHolePilotEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = RABBIT_HOLE_PILOT_EMAILS as readonly string[];
  return list.some((e) => e.toLowerCase() === normalized);
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
