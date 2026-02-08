/**
 * Admin Authorization Helpers
 * Protects admin-only routes and operations
 */

import { createUserClient } from '@/lib/supabase/server';

/**
 * Check if the current user is an admin based on ADMIN_EMAILS allowlist
 * @returns {Promise<{isAdmin: boolean, user: any | null, error: string | null}>}
 */
export async function checkAdminAuth(): Promise<{
  isAdmin: boolean;
  user: any | null;
  error: string | null;
}> {
  const supabase = await createUserClient();

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      isAdmin: false,
      user: null,
      error: 'Authentication required',
    };
  }

  // Check if user email is in admin allowlist
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  
  if (adminEmails.length === 0) {
    console.warn('ADMIN_EMAILS environment variable not configured');
    return {
      isAdmin: false,
      user,
      error: 'Admin access not configured',
    };
  }

  const userEmail = user.email?.toLowerCase();
  const isAdmin = userEmail ? adminEmails.includes(userEmail) : false;

  if (!isAdmin) {
    return {
      isAdmin: false,
      user,
      error: 'Forbidden: Admin access required',
    };
  }

  return {
    isAdmin: true,
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
