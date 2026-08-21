import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { recordSuccessfulLogin } from '@/lib/auth/login-tracking.server';
import {
  isSafeInternalRedirectPath,
  isSafeParticipantReturnPath,
  PARTICIPANT_AUTH_RETURN_COOKIE,
  participantAuthReturnCookieOptions,
} from '@/lib/participant-portal/participant-auth-return';
import { resolveCanonicalPublicOrigin } from '@/lib/runtime/customer-facing-url';

function canonicalRedirectBase(request: NextRequest): string {
  const origin = resolveCanonicalPublicOrigin(request);
  return origin || request.url;
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

  let redirectPath = candidateReturn ?? '/onboarding';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user ?? data.user;
      const verified = isEmailVerified(user);

      if (type === 'signup' || type === 'email' || verified) {
        recordAuthAuditEvent({
          eventType: AuditEventType.AUTH_EMAIL_VERIFIED,
          userId: user.id,
          email: user.email ?? undefined,
          request,
        });
      }

      if (verified) {
        await recordSuccessfulLogin({
          userId: user.id,
          email: user.email ?? undefined,
          request,
        });

        recordAuthAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
          userId: user.id,
          email: user.email ?? undefined,
          request,
          metadata: { source: 'email_callback' },
        });

        if (isSafeParticipantReturnPath(candidateReturn)) {
          redirectPath = candidateReturn;
        } else {
          const { resolveParticipantAuthDestinationForUser } = await import(
            '@/lib/participant-portal/participant-portal.server'
          );
          const restored = await resolveParticipantAuthDestinationForUser({
            email: user.email,
            id: user.id,
          });
          if (restored.kind === 'unique' || restored.kind === 'chooser') {
            redirectPath = restored.path;
          } else {
            redirectPath = candidateReturn ?? '/onboarding';
          }
        }
      } else {
        const verify = new URL('/auth/verify-email', canonicalRedirectBase(request));
        if (candidateReturn) {
          verify.searchParams.set('redirectedFrom', candidateReturn);
        }
        redirectPath = `${verify.pathname}${verify.search}`;
      }
    }
  }

  const response = NextResponse.redirect(new URL(redirectPath, canonicalRedirectBase(request)));
  if (request.cookies.get(PARTICIPANT_AUTH_RETURN_COOKIE)) {
    response.cookies.set(PARTICIPANT_AUTH_RETURN_COOKIE, '', participantAuthReturnCookieOptions(true));
  }
  return response;
}
