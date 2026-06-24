import 'server-only';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isEmailVerified, VERIFY_EMAIL_PATH } from '@/lib/auth/email-verification';
import { isSuspiciousLoginPending } from '@/lib/auth/login-tracking.server';

/**
 * Redirect unverified or suspicious-login users away from protected app surfaces.
 */
export async function enforceVerifiedSession(options?: {
  allowSuspicious?: boolean;
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
}
