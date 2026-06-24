import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { recordSuccessfulLogin } from '@/lib/auth/login-tracking.server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');

  let redirectPath = '/onboarding';

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

        redirectPath = '/onboarding';
      } else {
        redirectPath = '/auth/verify-email';
      }
    }
  }

  return NextResponse.redirect(new URL(redirectPath, request.url));
}
