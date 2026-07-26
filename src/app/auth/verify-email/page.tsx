import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { isEmailVerified } from '@/lib/auth/email-verification';
import { postLoginDestination } from '@/lib/journey/commercial-os-routes';
import { VerifyEmailClient } from './verify-email-client';

export const dynamic = 'force-dynamic';

export default async function VerifyEmailPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  if (isEmailVerified(user)) {
    redirect(postLoginDestination());
  }

  return <VerifyEmailClient email={user.email ?? ''} />;
}
