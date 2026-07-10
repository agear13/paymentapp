/**
 * Home — Mission Control operational homepage.
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { Suspense } from 'react';
import { OperationalHomeCommandCenter } from '@/components/operations/operational-home-command-center';
import { OnboardingWorkspacePreview } from '@/components/onboarding/onboarding-workspace-preview';
import { BillingCheckoutSuccessHandler } from '@/components/billing/billing-checkout-success-handler';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string; billing?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  const params = await searchParams;
  const showWorkspacePreview = params.workspace === 'ready';

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <BillingCheckoutSuccessHandler />
      </Suspense>
      {showWorkspacePreview ? (
        <OnboardingWorkspacePreview projectName={params.project} />
      ) : null}
      <OperationalHomeCommandCenter />
    </div>
  );
}
