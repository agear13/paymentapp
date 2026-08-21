import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';
import { applyRateLimit } from '@/lib/rate-limit';
import { enforceCsrfForRequest } from '@/lib/security/csrf';
import { findParticipantByPortalToken } from '@/lib/participant-portal/participant-portal.server';
import {
  isAuthorisedParticipantWorkspaceIdentity,
  normalizeParticipantEmail,
} from '@/lib/participant-portal/participant-access';
import { getParticipantSessionUser } from '@/lib/participant-portal/participant-session.server';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';
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

  const supabase = await createRouteHandlerSupabaseClient();
  const currentUser = await getParticipantSessionUser();
  if (
    currentUser &&
    !isAuthorisedParticipantWorkspaceIdentity({
      user: currentUser,
      participantEmail: found.participantEmail,
      authenticatedUserId: found.authenticatedUserId,
      dealOwnerUserId: found.dealUserId,
    })
  ) {
    await supabase.auth.signOut({ scope: 'local' });
  }

  const returnPath = participantWorkspaceReturnPath(token);
  const origin = resolveCanonicalPublicOrigin(request);
  const redirectTo = `${origin}/auth/callback?redirectedFrom=${encodeURIComponent(returnPath)}`;

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
