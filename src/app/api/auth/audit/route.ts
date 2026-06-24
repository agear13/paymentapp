import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { applyRateLimit } from '@/lib/rate-limit';

const CLIENT_AUTH_EVENTS = [
  AuditEventType.AUTH_LOGIN_SUCCESS,
  AuditEventType.AUTH_LOGIN_FAILED,
  AuditEventType.AUTH_LOGOUT,
  AuditEventType.AUTH_PASSWORD_RESET_REQUESTED,
  AuditEventType.AUTH_PASSWORD_RESET_COMPLETED,
  AuditEventType.AUTH_PASSWORD_CHANGE,
  AuditEventType.AUTH_MFA_ENABLED,
  AuditEventType.AUTH_MFA_DISABLED,
  AuditEventType.AUTH_MFA_RECOVERY_USED,
  AuditEventType.AUTH_EMAIL_VERIFIED,
  AuditEventType.AUTH_EMAIL_CHANGED,
  AuditEventType.AUTH_INVITE_ACCEPTED,
] as const;

const bodySchema = z.object({
  eventType: z.enum(CLIENT_AUTH_EVENTS),
  email: z.string().email().optional(),
  userId: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  success: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /api/auth/audit — fire-and-forget auth audit events from client flows.
 * Exempt from CSRF (pre-session events). Rate-limited.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await applyRateLimit(request, 'api');
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event payload' }, { status: 400 });
  }

  recordAuthAuditEvent({
    ...parsed.data,
    request,
    success: parsed.data.success ?? true,
  });

  return NextResponse.json({ ok: true });
}
