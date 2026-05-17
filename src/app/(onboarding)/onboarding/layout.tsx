import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { redirect } from 'next/navigation';

/** Layout reads session cookies; prerender must be skipped for this subtree. */
export const dynamic = 'force-dynamic';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const productProfile = await getDashboardProductProfile();

  if (
    productProfile === 'rabbit_hole_pilot' ||
    productProfile === 'strait_experiences_pilot'
  ) {
    redirect('/dashboard/partners/deal-network');
  }

  const organization = await getUserOrganization();
  if (organization) {
    const onboardingState = await getOperatorOnboardingState(organization.id);
    if (onboardingState?.completed || !onboardingState) {
      redirect('/dashboard');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

