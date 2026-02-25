/**
 * Supabase Browser Client
 * 
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  CLIENT-SIDE ONLY                                                             ║
 * ║                                                                               ║
 * ║  This module creates a browser-side Supabase client using @supabase/ssr.     ║
 * ║  Safe to import from 'use client' components.                                ║
 * ║                                                                               ║
 * ║  For server components, use: @/lib/supabase/server                           ║
 * ║  For API routes, use: @/lib/supabase/middleware (requireAuth)                ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
