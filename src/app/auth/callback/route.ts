import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType, User } from '@supabase/supabase-js';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { recordSuccessfulLogin } from '@/lib/auth/login-tracking.server';
import { loggers } from '@/lib/logger';
import {
  isParticipantInvitationReturn,
  planParticipantCallbackSession,
} from '@/lib/participant-portal/participant-auth-callback';
import {
  isSafeInternalRedirectPath,
  PARTICIPANT_AUTH_RETURN_COOKIE,
  participantAuthReturnCookieOptions,
  participantTokenFromReturnPath,
} from '@/lib/participant-portal/participant-auth-return';
import {
  PARTICIPANT_AUTH_CALLBACK_COMPLETE_PATH,
  safeCallbackNextPath,
} from '@/lib/participant-portal/participant-magic-link';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';
import {
  createAuthCookieBuffer,
  createRequestBoundSupabaseClient,
} from '@/lib/supabase/route-handler-client';

function canonicalRedirectBase(request: NextRequest): string {
  const origin = resolveCanonicalPublicOrigin(request);
  return origin || request.url;
}

function toSessionUser(user: User | null | undefined) {
  if (!user?.id) return null;
  return { id: user.id, email: user.email ?? null };
}

function cookieNamesFromResponse(response: NextResponse): string[] {
  return response.cookies.getAll().map((cookie) => cookie.name);
}

function completeSignInPath(nextPath: string | null, error?: string): string {
  const params = new URLSearchParams();
  if (nextPath) params.set('next', nextPath);
  if (error) params.set('error', error);
  const query = params.toString();
  return query ? `${PARTICIPANT_AUTH_CALLBACK_COMPLETE_PATH}?${query}` : PARTICIPANT_AUTH_CALLBACK_COMPLETE_PATH;
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
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const redirectedFrom = requestUrl.searchParams.get('redirectedFrom');
  const nextParam = requestUrl.searchParams.get('next');
  const cookieReturn = request.cookies.get(PARTICIPANT_AUTH_RETURN_COOKIE)?.value ?? null;
  const candidateReturn =
    safeCallbackNextPath(nextParam, redirectedFrom, cookieReturn) ||
    (isSafeInternalRedirectPath(redirectedFrom) ? redirectedFrom : null) ||
    (isSafeInternalRedirectPath(nextParam) ? nextParam : null);

  const origin = canonicalRedirectBase(request);
  const cookieBuffer = createAuthCookieBuffer();
  const supabase = createRequestBoundSupabaseClient(request, cookieBuffer);

  const logBase = {
    callbackUrl: `${requestUrl.origin}${requestUrl.pathname}`,
    hasCode: Boolean(code),
    codeLength: code?.length ?? 0,
    hasTokenHash: Boolean(tokenHash),
    nextParam,
    redirectedFrom,
    candidateReturn,
  };

  loggers.auth.info('participant_auth_callback_received', logBase);

  const redirectWithCookies = (path: string, extra?: Record<string, unknown>) => {
    const response = NextResponse.redirect(new URL(path, origin));
    cookieBuffer.applyTo(response);
    if (request.cookies.get(PARTICIPANT_AUTH_RETURN_COOKIE)) {
      response.cookies.set(
        PARTICIPANT_AUTH_RETURN_COOKIE,
        '',
        participantAuthReturnCookieOptions(true)
      );
    }
    loggers.auth.info('participant_auth_callback_response', {
      ...logBase,
      ...extra,
      setCookieNames: cookieNamesFromResponse(response),
      redirectDestination: response.headers.get('location'),
    });
    return response;
  };

  if (!code && !tokenHash) {
    loggers.auth.warn('participant_auth_callback_missing_code', {
      ...logBase,
      exchangeCalled: false,
      note: 'Hash tokens are not visible to this route; completing on the client page.',
    });
    return redirectWithCookies(completeSignInPath(candidateReturn, undefined), {
      exchangeCalled: false,
      exchangeError: null,
    });
  }

  let exchangeError: string | null = null;
  let exchangedUser: User | null = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error?.message ?? null;
    exchangedUser = data.user ?? null;
    loggers.auth.info('participant_auth_callback_exchange', {
      ...logBase,
      exchangeCalled: true,
      exchangeError,
      exchangedUserId: exchangedUser?.id ?? null,
      exchangedUserEmail: exchangedUser?.email ?? null,
    });
  } else if (tokenHash) {
    const otpType: EmailOtpType =
      type === 'signup' ||
      type === 'email' ||
      type === 'magiclink' ||
      type === 'recovery' ||
      type === 'invite'
        ? type
        : 'magiclink';
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    exchangeError = error?.message ?? null;
    exchangedUser = data.user ?? null;
    loggers.auth.info('participant_auth_callback_verify_otp', {
      ...logBase,
      exchangeCalled: true,
      exchangeError,
      exchangedUserId: exchangedUser?.id ?? null,
      exchangedUserEmail: exchangedUser?.email ?? null,
    });
  }

  const exchangeSucceeded = !exchangeError && Boolean(exchangedUser);

  if (!exchangeSucceeded) {
    return redirectWithCookies(completeSignInPath(candidateReturn, 'exchange_failed'), {
      exchangeCalled: true,
      exchangeError,
      exchangedUserId: exchangedUser?.id ?? null,
      exchangedUserEmail: exchangedUser?.email ?? null,
    });
  }

  let getUserResult: User | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    getUserResult = userData.user ?? null;
  } catch {
    getUserResult = null;
  }

  const callbackUser =
    getUserResult?.id === exchangedUser.id ? getUserResult : exchangedUser;

  let redirectPath = completeSignInPath(candidateReturn);

  if (isParticipantInvitationReturn(candidateReturn)) {
    const token = participantTokenFromReturnPath(candidateReturn);
    const { findParticipantByPortalToken } = await import(
      '@/lib/participant-portal/participant-portal.server'
    );
    const found = token ? await findParticipantByPortalToken(token) : null;
    const plan = planParticipantCallbackSession({
      candidateReturn,
      exchangeSucceeded: true,
      exchangedUser: toSessionUser(exchangedUser),
      getUserResult: toSessionUser(getUserResult),
      participant: found
        ? {
            invitedEmail: found.participantEmail,
            authenticatedUserId: found.authenticatedUserId,
            dealOwnerUserId: found.dealUserId,
          }
        : null,
    });

    if (callbackUser && !isEmailVerified(callbackUser)) {
      const verify = new URL('/auth/verify-email', origin);
      verify.searchParams.set('redirectedFrom', candidateReturn);
      redirectPath = `${verify.pathname}${verify.search}`;
    } else {
      await recordVerifiedLogin({ user: callbackUser, request, type });
      redirectPath = plan.redirectPath;
    }
  } else if (callbackUser) {
    const verified = await recordVerifiedLogin({ user: callbackUser, request, type });
    if (!verified) {
      const verify = new URL('/auth/verify-email', origin);
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

  return redirectWithCookies(redirectPath, {
    exchangeCalled: true,
    exchangeError: null,
    exchangedUserId: exchangedUser.id,
    exchangedUserEmail: exchangedUser.email ?? null,
    getUserId: getUserResult?.id ?? null,
  });
}
