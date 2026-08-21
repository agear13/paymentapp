import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { enforceCsrfForRequest } from '@/lib/security/csrf';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/sign-out
 * Clears the current browser's Supabase cookies (local scope).
 * Used by participant recovery so a leftover operator session cannot survive client signOut().
 */
export async function POST(request: NextRequest) {
  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) return csrfBlock;

  const supabase = await createRouteHandlerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) {
    return NextResponse.json({ ok: false, error: 'Could not sign out' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, signedOut: true });
}
