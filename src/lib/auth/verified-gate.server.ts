import 'server-only';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isEmailVerified, VERIFY_EMAIL_PATH } from '@/lib/auth/email-verification';
import { isSuspiciousLoginPending } from '@/lib/auth/login-tracking.server';
import { getMfaAssuranceSnapshot } from '@/lib/auth/mfa.server';
import { enrolledUserNeedsMfaChallenge, MFA_CHALLENGE_PATH } from '@/lib/auth/mfa-assurance';

/**
 * Redirect unverified or suspicious-login users away from protected app surfaces.
 */
export async function enforceVerifiedSession(options?: {
  allowSuspicious?: boolean;
  allowAal1?: boolean;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  if (!isEmailVerified(user)) {
    redirect(VERIFY_EMAIL_PATH);
  }

  if (!options?.allowSuspicious) {
    const suspicious = await isSuspiciousLoginPending(user.id);
    if (suspicious) {
      redirect('/auth/confirm-login');
    }
  }

  if (!options?.allowAal1) {
    const snapshot = await getMfaAssuranceSnapshot();
    if (
      enrolledUserNeedsMfaChallenge({
        verifiedTotpCount: snapshot.verifiedTotpCount,
        currentLevel: snapshot.currentLevel,
      })
    ) {
      redirect(MFA_CHALLENGE_PATH);
    }
  }
}
