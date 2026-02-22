/**
 * Admin Authorization Helpers - SERVER ONLY
 * Protects admin-only routes and operations
 * 
 * WARNING: This module uses next/headers via Supabase. 
 * Do NOT import this from client components.
 * For client-safe helpers, use ./admin-shared.ts
 */
import 'server-only';

import { createUserClient } from '@/lib/supabase/server';
import { isBetaAdminEmail, BETA_ADMIN_EMAILS, requireBetaAdminOrThrow } from './admin-shared';

// Re-export client-safe helpers for convenience in server code
export { isBetaAdminEmail, BETA_ADMIN_EMAILS, requireBetaAdminOrThrow };

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
