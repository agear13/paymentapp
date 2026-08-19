import 'server-only';

import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isEmailVerified, EMAIL_VERIFICATION_REQUIRED_MESSAGE } from '@/lib/auth/email-verification';
import { AuthError } from '@/lib/auth/errors';
import { isSuspiciousLoginPending } from '@/lib/auth/login-tracking.server';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { enrolledUserNeedsMfaChallenge } from '@/lib/auth/mfa-assurance';

export function assertEmailVerified(user: User): void {
  if (!isEmailVerified(user)) {
    throw new AuthError(EMAIL_VERIFICATION_REQUIRED_MESSAGE, 'EMAIL_NOT_CONFIRMED');
  }
}

export async function assertNoPendingSuspiciousLogin(userId: string): Promise<void> {
  const pending = await isSuspiciousLoginPending(userId);
  if (pending) {
    throw new AuthError(
      'Unusual sign-in activity detected. Please confirm this sign-in from your email.',
      'FORBIDDEN',
      { code: 'SUSPICIOUS_LOGIN_PENDING' }
    );
  }
}

export function emailNotVerifiedResponse() {
  return NextResponse.json(
    {
      error: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
      code: 'EMAIL_NOT_VERIFIED',
    },
    { status: 403 }
  );
}

export function suspiciousLoginResponse() {
  return NextResponse.json(
    {
      error: 'Unusual sign-in activity detected. Please confirm this sign-in.',
      code: 'SUSPICIOUS_LOGIN_PENDING',
    },
    { status: 403 }
  );
}

export async function assertMfaChallengeSatisfied(): Promise<void> {
  const snapshot = await getMfaAssuranceSnapshot();
  if (
    enrolledUserNeedsMfaChallenge({
      verifiedTotpCount: snapshot.verifiedTotpCount,
      currentLevel: snapshot.currentLevel,
    })
  ) {
    throw new AuthError(
      'Two-factor authentication is required. Enter the code from your authenticator app.',
      'FORBIDDEN',
      { code: 'MFA_CHALLENGE_REQUIRED' }
    );
  }
}

export function mfaChallengeRequiredResponse() {
  return NextResponse.json(
    {
      error: 'Two-factor authentication is required. Enter the code from your authenticator app.',
      code: 'MFA_CHALLENGE_REQUIRED',
      challengePath: '/auth/mfa',
    },
    { status: 403 }
  );
}
