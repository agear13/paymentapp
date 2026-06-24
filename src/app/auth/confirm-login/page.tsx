import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isSuspiciousLoginPending, getUserAuthProfile } from '@/lib/auth/login-tracking.server';
import { ConfirmLoginClient } from './confirm-login-client';

export const dynamic = 'force-dynamic';

export default async function ConfirmLoginPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const pending = await isSuspiciousLoginPending(user.id);
  if (!pending) {
    redirect('/dashboard');
  }

  const profile = await getUserAuthProfile(user.id);

  return (
    <ConfirmLoginClient reason={profile?.suspiciousLoginReason} />
  );
}
