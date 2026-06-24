import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { VerifyEmailClient } from './verify-email-client';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  if (isEmailVerified(user)) {
    redirect('/dashboard');
  }

  return <VerifyEmailClient email={user.email ?? ''} />;
}
