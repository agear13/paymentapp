export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getUserOrganization } from '@/lib/auth/get-org';
import { LovableJourneyShell } from '@/components/journey/lovable/lovable-journey-shell';
import { WorkspaceProvisioningScreen } from '@/components/journey/lovable/workspace-provisioning-screen';

export default async function JourneyProvisioningBuildPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/login?redirectedFrom=/journey/provisioning/build');
  }

  const organization = await getUserOrganization();
  if (!organization) {
    redirect('/onboarding');
  }

  return (
    <LovableJourneyShell>
      <WorkspaceProvisioningScreen />
    </LovableJourneyShell>
  );
}
