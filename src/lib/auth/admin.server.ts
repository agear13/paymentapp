/**
 * Admin Authorization Helpers - SERVER ONLY
 * Protects admin-only routes and operations
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  WARNING: SERVER-ONLY MODULE                                                  ║
 * ║                                                                               ║
 * ║  This module uses next/headers via Supabase server client.                   ║
 * ║  It MUST NEVER be imported from:                                             ║
 * ║    - Any file with 'use client' directive                                    ║
 * ║    - Any component that could be bundled client-side                         ║
 * ║                                                                               ║
 * ║  For client-safe helpers, use: @/lib/auth/admin-shared                       ║
 * ║                                                                               ║
 * ║  The 'server-only' import below will cause a build error if this module      ║
 * ║  is accidentally imported from client code.                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import 'server-only';

import { createUserClient } from '@/lib/supabase/server';
import config from '@/lib/config/env';
import { isBetaAdminEmail, BETA_ADMIN_EMAILS, requireBetaAdminOrThrow } from './admin-shared';

// Re-export client-safe helpers for convenience in server code
export { isBetaAdminEmail, BETA_ADMIN_EMAILS, requireBetaAdminOrThrow };

/**
 * Check if the current user is an admin based on ADMIN_EMAIL_ALLOWLIST (B5 C4).
 * Legacy ADMIN_EMAILS is merged at startup; see config.admin.emailAllowlist.
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

  const adminEmails = config.admin.emailAllowlist;

  if (adminEmails.length === 0) {
    console.warn(
      'Admin allowlist not configured; set ADMIN_EMAIL_ALLOWLIST (ADMIN_EMAILS is deprecated)'
    );
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
