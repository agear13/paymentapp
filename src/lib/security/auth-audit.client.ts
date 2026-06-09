'use client';

type ClientAuthAuditEvent =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.password.reset.requested'
  | 'auth.password.reset.completed'
  | 'auth.mfa.enabled'
  | 'auth.mfa.disabled'
  | 'auth.mfa.recovery.used'
  | 'auth.email.verified'
  | 'auth.invite.accepted';

export async function emitAuthAuditEvent(payload: {
  eventType: ClientAuthAuditEvent;
  email?: string;
  userId?: string;
  organizationId?: string;
  success?: boolean;
  reason?: string;
}): Promise<void> {
  try {
    await fetch('/api/auth/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Never block auth UX on audit failure.
  }
}
