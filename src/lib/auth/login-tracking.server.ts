import 'server-only';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/server/prisma';
import { AuditEventType } from '@/lib/audit/audit-log';
import { recordAuthAuditEvent } from '@/lib/audit/auth-audit.server';
import { hashIpAddress } from '@/lib/auth/ip-hash';
import { parseUserAgent, resolveLocationFromRequest } from '@/lib/auth/user-agent-parse';
import { evaluateSuspiciousLogin } from '@/lib/auth/suspicious-login.server';

export type UserAuthProfile = {
  userId: string;
  lastLoginAt: Date | null;
  lastLoginBrowser: string | null;
  lastLoginOs: string | null;
  lastLoginLocation: string | null;
  suspiciousLoginPending: boolean;
  suspiciousLoginReason: string | null;
};

export async function getUserAuthProfile(userId: string): Promise<UserAuthProfile | null> {
  const row = await prisma.user_auth_profiles.findUnique({ where: { user_id: userId } });
  if (!row) return null;
  return {
    userId: row.user_id,
    lastLoginAt: row.last_login_at,
    lastLoginBrowser: row.last_login_browser,
    lastLoginOs: row.last_login_os,
    lastLoginLocation: row.last_login_location,
    suspiciousLoginPending: row.suspicious_login_pending,
    suspiciousLoginReason: row.suspicious_login_reason,
  };
}

export async function recordSuccessfulLogin(input: {
  userId: string;
  email?: string;
  request: NextRequest;
}): Promise<{ suspicious: boolean; reason?: string }> {
  const userAgent = input.request.headers.get('user-agent') ?? undefined;
  const parsed = parseUserAgent(userAgent);
  const location = resolveLocationFromRequest(input.request.headers);
  const ipHash = hashIpAddress(
    input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      input.request.headers.get('x-real-ip') ??
      input.request.headers.get('cf-connecting-ip')
  );

  const existing = await prisma.user_auth_profiles.findUnique({
    where: { user_id: input.userId },
  });

  const suspiciousResult = evaluateSuspiciousLogin({
    userId: input.userId,
    previousLocation: existing?.last_login_location,
    previousLoginAt: existing?.last_login_at,
    currentLocation: location,
  });

  const now = new Date();

  await prisma.user_auth_profiles.upsert({
    where: { user_id: input.userId },
    create: {
      user_id: input.userId,
      last_login_at: now,
      last_login_browser: parsed.browser,
      last_login_os: parsed.os,
      last_login_location: location ?? null,
      last_login_ip_hash: ipHash ?? null,
      previous_login_at: null,
      previous_login_location: null,
      suspicious_login_pending: suspiciousResult.suspicious,
      suspicious_login_reason: suspiciousResult.reason ?? null,
    },
    update: {
      previous_login_at: existing?.last_login_at ?? null,
      previous_login_location: existing?.last_login_location ?? null,
      last_login_at: now,
      last_login_browser: parsed.browser,
      last_login_os: parsed.os,
      last_login_location: location ?? null,
      last_login_ip_hash: ipHash ?? null,
      suspicious_login_pending: suspiciousResult.suspicious,
      suspicious_login_reason: suspiciousResult.reason ?? null,
    },
  });

  if (suspiciousResult.suspicious) {
    recordAuthAuditEvent({
      eventType: AuditEventType.SECURITY_SUSPICIOUS_LOGIN,
      userId: input.userId,
      email: input.email,
      request: input.request,
      metadata: {
        ruleId: suspiciousResult.ruleId,
        reason: suspiciousResult.reason,
        location,
      },
      success: false,
    });
  }

  return { suspicious: suspiciousResult.suspicious, reason: suspiciousResult.reason };
}

export async function clearSuspiciousLoginFlag(userId: string): Promise<void> {
  await prisma.user_auth_profiles.updateMany({
    where: { user_id: userId },
    data: {
      suspicious_login_pending: false,
      suspicious_login_reason: null,
    },
  });
}

export async function isSuspiciousLoginPending(userId: string): Promise<boolean> {
  const row = await prisma.user_auth_profiles.findUnique({
    where: { user_id: userId },
    select: { suspicious_login_pending: true },
  });
  return Boolean(row?.suspicious_login_pending);
}
