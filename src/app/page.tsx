import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { JourneyLandingPage } from '@/components/journey/lovable';
import { PublicLandingPage } from '@/components/marketing/public-landing-page';
import { isHackathonJourneyEnabled } from '@/lib/journey/hackathon-journey';

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

  if (isHackathonJourneyEnabled()) {
    return <JourneyLandingPage />;
  }

  return <PublicLandingPage />;
}
