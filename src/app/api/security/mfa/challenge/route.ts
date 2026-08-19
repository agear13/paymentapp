import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { authJsonError, authSuccess } from '@/lib/auth/auth-api.shared';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

const MFA_SESSION_OPTIONS = {
  allowAal1: true,
  allowSuspiciousLogin: true,
} as const;

const bodySchema = z.object({
  factorId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const auth = await getCurrentUserForApi(request, MFA_SESSION_OPTIONS);
  if (!auth.user) {
    return auth.response ?? authJsonError('Authentication required', 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return authJsonError('Invalid request body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return authJsonError('factorId is required', 400);
  }

  const supabase = await createRouteHandlerSupabaseClient();
  const { data, error } = await supabase.auth.mfa.challenge({
    factorId: parsed.data.factorId,
  });

  if (error || !data) {
    return authJsonError('Could not start authenticator challenge.', 400);
  }

  return authSuccess({
    factorId: parsed.data.factorId,
    challengeId: data.id,
  });
}
