import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import {
  MFA_CHALLENGE_PATH,
  MFA_ENROLL_PATH,
  MFA_STEP_UP_MESSAGES,
  resolveSensitiveActionBlock,
  type MfaStepUpCode,
} from '@/lib/auth/mfa-assurance';

export function stepUpDeniedResponse(code: MfaStepUpCode): NextResponse {
  return NextResponse.json(
    {
      error: MFA_STEP_UP_MESSAGES[code],
      code,
      enrollPath: MFA_ENROLL_PATH,
      challengePath: MFA_CHALLENGE_PATH,
    },
    { status: 403 }
  );
}

export async function assertRecentStepUp(input: {
  request: NextRequest;
  userId: string;
  email?: string | null;
}): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse; code: MfaStepUpCode }
> {
  const snapshot = await getMfaAssuranceSnapshot();
  const code = resolveSensitiveActionBlock({
    verifiedTotpCount: snapshot.verifiedTotpCount,
    currentLevel: snapshot.currentLevel,
    methods: snapshot.methods,
  });

  recordAuthAuditEvent({
    eventType: code
      ? AuditEventType.AUTH_STEP_UP_FAILED
      : AuditEventType.AUTH_STEP_UP_SUCCESS,
    userId: input.userId,
    email: input.email ?? undefined,
    request: input.request,
    success: !code,
    reason: code ?? undefined,
    metadata: {
      currentLevel: snapshot.currentLevel,
      verifiedTotpCount: snapshot.verifiedTotpCount,
    },
  });

  if (code) {
    return { ok: false, response: stepUpDeniedResponse(code), code };
  }
  return { ok: true };
}

export function redirectToMfaForStepUp(
  request: NextRequest,
  code: MfaStepUpCode
): NextResponse {
  const dest =
    code === 'MFA_ENROLLMENT_REQUIRED' ? MFA_ENROLL_PATH : MFA_CHALLENGE_PATH;
  const url = new URL(dest, request.url);
  url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  url.searchParams.set('reason', code);
  return NextResponse.redirect(url);
}

/**
 * OWNER `manage_settings` plus recent MFA/AAL2 for payment-destination mutations.
 */
export async function requirePaymentConfigurationAccess(
  request: NextRequest,
  clientOrganizationId?: string | null
): Promise<
  | { ok: true; user: User; organizationId: string }
  | { ok: false; response: NextResponse; code?: MfaStepUpCode }
> {
  const auth = await getCurrentUserForApi(request);
  if (!auth.user) {
    return { ok: false, response: auth.response! };
  }

  const resolved = await resolveSessionOrganizationId(
    auth.user.id,
    clientOrganizationId,
    'payment-configuration'
  );
  if (resolved.response || !resolved.organizationId) {
    return {
      ok: false,
      response:
        resolved.response ??
        NextResponse.json({ error: 'Organization required' }, { status: 403 }),
    };
  }

  const canManage = await hasOrganizationPermission(
    auth.user.id,
    resolved.organizationId,
    'manage_settings'
  );
  if (!canManage) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      ),
    };
  }

  const stepUp = await assertRecentStepUp({
    request,
    userId: auth.user.id,
    email: auth.user.email,
  });
  if (!stepUp.ok) {
    return { ok: false, response: stepUp.response, code: stepUp.code };
  }

  return { ok: true, user: auth.user, organizationId: resolved.organizationId };
}
