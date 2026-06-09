import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      recordAuthAuditEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: data.user.id,
        email: data.user.email ?? undefined,
        request,
      });
    }
  }

  // Redirect to onboarding (new users need to set up)
  // The onboarding page will redirect to dashboard if org already exists
  return NextResponse.redirect(new URL('/onboarding', request.url));
}

