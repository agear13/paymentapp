/**
 * Admin Authorization Helpers
 * Protects admin-only routes and operations
 */

import { createUserClient } from '@/lib/supabase/server';

/**
 * Beta lockdown admin emails - hardcoded for safety
 * Only these accounts can see Revenue Share and Platform Preview features
 */
export const BETA_ADMIN_EMAILS = ['alishajayne13@gmail.com'] as const;

/**
 * Check if an email is a beta admin (case-insensitive)
 * Used for feature gating during beta testing
 */
export function isBetaAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return BETA_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === normalized);
}

/**
 * Require beta admin access or throw 403 error
 * Use this in API routes that should be restricted during beta
 */
export function requireBetaAdminOrThrow(sessionUserEmail?: string | null): void {
  if (!isBetaAdminEmail(sessionUserEmail)) {
    const error = new Error('Forbidden: Beta admin access required');
    (error as any).status = 403;
    throw error;
  }
}

/**
 * Check if the current user is an admin based on ADMIN_EMAILS allowlist
 * @returns {Promise<{isAdmin: boolean, userEmail: string | null, user: any | null, error: string | null}>}
 */
export async function checkAdminAuth(): Promise<{
  isAdmin: boolean;
  userEmail: string | null;
  user: any | null;
  error: string | null;
}> {
  const supabase = await createUserClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      userEmail: null,
      user: null,
      error: 'Authentication required',
    };
  }

  const userEmail = user.email?.toLowerCase() ?? null;

  // Check if user email is in admin allowlist
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];

  if (adminEmails.length === 0) {
    console.warn('ADMIN_EMAILS environment variable not configured');
    return {
      isAdmin: false,
      userEmail,
      user,
      error: 'Admin access not configured',
    };
  }

  const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;

  if (!isAdmin) {
    return {
      isAdmin: false,
      userEmail,
      user,
      error: 'Forbidden: Admin access required',
    };
  }

  return {
    isAdmin: true,
    userEmail,
    user,
    error: null,
  };
}

/**
 * Require admin auth or throw error
 * Use this in API routes that require admin access
 */
export async function requireAdminAuth() {
  const { isAdmin, user, error } = await checkAdminAuth();

  if (!isAdmin) {
    throw new Error(error || 'Unauthorized');
  }

  return user;
}

/**
 * Check if beta admin auth is satisfied for current user
 * Returns the same structure as checkAdminAuth but uses BETA_ADMIN_EMAILS
 */
export async function checkBetaAdminAuth(): Promise<{
  isAdmin: boolean;
  userEmail: string | null;
  user: any | null;
  error: string | null;
}> {
  const supabase = await createUserClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      userEmail: null,
      user: null,
      error: 'Authentication required',
    };
  }

  const userEmail = user.email ?? null;
  const isAdmin = isBetaAdminEmail(userEmail);

  if (!isAdmin) {
    return {
      isAdmin: false,
      userEmail,
      user,
      error: 'Forbidden: Beta admin access required',
    };
  }

  return {
    isAdmin: true,
    userEmail,
    user,
    error: null,
  };
}
