import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { enforceCsrfForRequest } from '@/lib/security/csrf';
import { findParticipantByPortalToken } from '@/lib/participant-portal/participant-portal.server';
import { normalizeParticipantEmail } from '@/lib/participant-portal/participant-access';
import { resolveRequestOrigin } from '@/lib/runtime/customer-facing-url';
import {
  PARTICIPANT_AUTH_RETURN_COOKIE,
  participantAuthReturnCookieOptions,
  participantWorkspaceReturnPath,
} from '@/lib/participant-portal/participant-auth-return';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const rate = await applyRateLimit(request, 'auth');
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many sign-in attempts. Try again shortly.' }, { status: 429 });
  }

  const csrfBlock = enforceCsrfForRequest(request);
  if (csrfBlock) return csrfBlock;

  const { token: raw } = await context.params;
  const token = decodeURIComponent(raw ?? '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const found = await findParticipantByPortalToken(token);
  const invitedEmail = normalizeParticipantEmail(found?.participantEmail);
  if (!found || !invitedEmail) {
    return NextResponse.json(
      { error: 'This invitation cannot be used for sign-in. Contact the organiser.' },
      { status: 404 }
    );
  }

  const returnPath = participantWorkspaceReturnPath(token);
  const origin = resolveRequestOrigin(request) || request.nextUrl.origin;
  const redirectTo = `${origin}/auth/callback?redirectedFrom=${encodeURIComponent(returnPath)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: invitedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    return NextResponse.json(
      { error: 'Could not send a sign-in link. Please try again.' },
      { status: 502 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PARTICIPANT_AUTH_RETURN_COOKIE,
    returnPath,
    participantAuthReturnCookieOptions()
  );
  return response;
}
