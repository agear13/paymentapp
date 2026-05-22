/**
 * Home — operational coordination dashboard (not analytics KPIs).
 */
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { OperationalHomeCommandCenter } from '@/components/operations/operational-home-command-center';
import { OnboardingWorkspacePreview } from '@/components/onboarding/onboarding-workspace-preview';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; project?: string }>;
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
      {showWorkspacePreview ? (
        <OnboardingWorkspacePreview projectName={params.project} />
      ) : null}
      <OperationalHomeCommandCenter />
    </div>
  );
}
