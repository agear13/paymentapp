/**
 * Beta Admin Server Check
 * 
 * SERVER-ONLY module for checking beta admin status.
 * Uses Supabase server client with cookies/headers.
 * 
 * DO NOT import this from client components.
 */
import 'server-only';

import { createUserClient } from '@/lib/supabase/server';
import { isBetaAdminEmail, BETA_ADMIN_EMAILS } from './admin-shared';

// Re-export for convenience
export { BETA_ADMIN_EMAILS };

/**
 * Check if the current authenticated user is a beta admin
 * 
 * This function:
 * 1. Gets the current user from Supabase server auth (via cookies)
 * 2. Checks their email against the BETA_ADMIN_EMAILS allowlist
 * 3. Returns false if no user, no email, or not in allowlist
 * 
 * @returns Promise<boolean> - true if current user is a beta admin
 */
export async function getIsBetaAdmin(): Promise<boolean> {
  try {
    const supabase = await createUserClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return false;
    }

    return isBetaAdminEmail(user.email);
  } catch {
    return false;
  }
}
