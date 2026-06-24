import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { getDashboardProductProfile } from '@/lib/auth/dashboard-product.server';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { enforceVerifiedSession } from '@/lib/auth/verified-gate.server';
import { redirect } from 'next/navigation';
import { CsrfBootstrap } from '@/components/security/csrf-bootstrap';

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

  await enforceVerifiedSession({ allowSuspicious: true });

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
    <>
      <CsrfBootstrap />
      <div className="min-h-screen bg-gradient-to-b from-[rgba(124,92,255,0.04)] via-background to-background px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center">{children}</div>
      </div>
    </>
  );
}

