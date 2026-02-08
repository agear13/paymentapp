/**
 * Supabase Admin Client
 * SERVER ONLY - Do not import into client components
 * 
 * Uses service role key to bypass RLS for admin operations
 * Use this ONLY for:
 * - Admin approval/rejection routes
 * - Deterministic writes that must not be blocked by RLS
 * - Partner ledger entry creation
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Helper to ensure required environment variables exist
 * @throws Error if environment variable is missing
 */
function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `This is required for admin operations. See SUPABASE_DUAL_CLIENTS.md for setup.`
    );
  }
  return value;
}

/**
 * Create Supabase admin client with service role key
 * This bypasses Row Level Security (RLS) - use with caution
 * @returns Supabase client with admin privileges
 */
export function createAdminClient() {
  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
