import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { PublicLandingPage } from '@/components/marketing/public-landing-page';

/** Uses cookie-backed Supabase (`getCurrentUser`); cannot be statically generated. */
export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    const organization = await getUserOrganization();

    if (!organization) {
      redirect('/onboarding');
    }

    redirect('/dashboard');
  }

  return <PublicLandingPage />;
}
