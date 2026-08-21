import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { recordSuccessfulLogin } from '@/lib/auth/login-tracking.server';
import {
  isParticipantInvitationReturn,
  planParticipantCallbackSession,
} from '@/lib/participant-portal/participant-auth-callback';
import {
  isSafeInternalRedirectPath,
  isSafeParticipantReturnPath,
  PARTICIPANT_AUTH_RETURN_COOKIE,
  participantAuthReturnCookieOptions,
  participantTokenFromReturnPath,
} from '@/lib/participant-portal/participant-auth-return';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';
import { createRouteHandlerSupabaseClient } from '@/lib/supabase/route-handler-client';

function canonicalRedirectBase(request: NextRequest): string {
  const origin = resolveCanonicalPublicOrigin(request);
  return origin || request.url;
}

function toSessionUser(user: User | null | undefined) {
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null };
}

async function recordVerifiedLogin(input: {
  user: User;
  request: NextRequest;
  type: string | null;
}) {
  const verified = isEmailVerified(input.user);
  if (input.type === 'signup' || input.type === 'email' || verified) {
    recordAuthAuditEvent({
      eventType: AuditEventType.AUTH_EMAIL_VERIFIED,
      userId: input.user.id,
      email: input.user.email ?? undefined,
      request: input.request,
    });
  }
  if (!verified) return false;

  await recordSuccessfulLogin({
    userId: input.user.id,
    email: input.user.email ?? undefined,
    request: input.request,
  });
  recordAuthAuditEvent({
    eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
    userId: input.user.id,
    email: input.user.email ?? undefined,
    request: input.request,
    metadata: { source: 'email_callback' },
  });
  return true;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');

  const redirectedFrom = requestUrl.searchParams.get('redirectedFrom');
  const cookieReturn = request.cookies.get(PARTICIPANT_AUTH_RETURN_COOKIE)?.value ?? null;
  const candidateReturn =
    (isSafeParticipantReturnPath(redirectedFrom) && redirectedFrom) ||
    (isSafeParticipantReturnPath(cookieReturn) && cookieReturn) ||
    (isSafeInternalRedirectPath(redirectedFrom) && redirectedFrom) ||
    null;

  let redirectPath = isParticipantInvitationReturn(candidateReturn)
    ? candidateReturn
    : candidateReturn ?? '/onboarding';

  const supabase = await createRouteHandlerSupabaseClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    const exchangeSucceeded = !error && Boolean(data.user);

    let getUserResult: User | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      getUserResult = userData.user ?? null;
    } catch {
      getUserResult = null;
    }

    const callbackUser =
      exchangeSucceeded && data.user
        ? getUserResult?.id === data.user.id
          ? getUserResult
          : data.user
        : getUserResult;

    if (isParticipantInvitationReturn(candidateReturn)) {
      const token = participantTokenFromReturnPath(candidateReturn);
      const { findParticipantByPortalToken } = await import(
        '@/lib/participant-portal/participant-portal.server'
      );
      const found = token ? await findParticipantByPortalToken(token) : null;
      const plan = planParticipantCallbackSession({
        candidateReturn,
        exchangeSucceeded,
        exchangedUser: toSessionUser(data.user),
        getUserResult: toSessionUser(getUserResult),
        participant: found
          ? {
              invitedEmail: found.participantEmail,
              authenticatedUserId: found.authenticatedUserId,
              dealOwnerUserId: found.dealUserId,
            }
          : null,
      });

      // Only leftover *failed* exchanges may sign out. A successful participant
      // exchange must keep the cookies written by exchangeCodeForSession.
      if (plan.signOutLeftoverSession) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      redirectPath = plan.redirectPath;

      if (exchangeSucceeded && callbackUser && !isEmailVerified(callbackUser)) {
        const verify = new URL('/auth/verify-email', canonicalRedirectBase(request));
        verify.searchParams.set('redirectedFrom', candidateReturn);
        redirectPath = `${verify.pathname}${verify.search}`;
      } else if (exchangeSucceeded && callbackUser) {
        await recordVerifiedLogin({ user: callbackUser, request, type });
      }
    } else if (exchangeSucceeded && callbackUser) {
      const verified = await recordVerifiedLogin({ user: callbackUser, request, type });
      if (!verified) {
        const verify = new URL('/auth/verify-email', canonicalRedirectBase(request));
        if (candidateReturn) {
          verify.searchParams.set('redirectedFrom', candidateReturn);
        }
        redirectPath = `${verify.pathname}${verify.search}`;
      } else {
        const { resolveParticipantAuthDestinationForUser } = await import(
          '@/lib/participant-portal/participant-portal.server'
        );
        const restored = await resolveParticipantAuthDestinationForUser({
          email: callbackUser.email,
          id: callbackUser.id,
        });
        if (restored.kind === 'unique' || restored.kind === 'chooser') {
          redirectPath = restored.path;
        } else {
          redirectPath = candidateReturn ?? '/onboarding';
        }
      }
    }
  }

  const response = NextResponse.redirect(new URL(redirectPath, canonicalRedirectBase(request)));
  if (request.cookies.get(PARTICIPANT_AUTH_RETURN_COOKIE)) {
    response.cookies.set(PARTICIPANT_AUTH_RETURN_COOKIE, '', participantAuthReturnCookieOptions(true));
  }
  return response;
}
