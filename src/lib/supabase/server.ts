/**
 * Supabase User/Session Client (Server)
 * For user-facing operations and authentication checks
 * 
 * Uses anon key + cookie-based sessions
 * Subject to Row Level Security (RLS)
 * 
 * WARNING: This module uses next/headers and is SERVER-ONLY.
 * Do NOT import this from client components.
 */
import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Helper to ensure required environment variables exist
 * @throws Error if environment variable is missing
 */
function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `This is required for Supabase integration. See SUPABASE_DUAL_CLIENTS.md for setup.`
    );
  }
  return value;
}

/**
 * Create Supabase user client with session management
 * Uses cookie-based authentication and respects RLS
 * @returns Supabase client for user operations
 */
export async function createUserClient() {
  const cookieStore = await cookies();

  const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * @deprecated Use createUserClient() instead
 * Kept for backward compatibility during migration
 */
export async function createClient() {
  return createUserClient();
}
