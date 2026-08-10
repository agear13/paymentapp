'use client';

import { useSearchParams } from 'next/navigation';
import { WorkspaceCreateScreen } from '@/components/journey/lovable/workspace-create-screen';
import { WorkspaceProvisioningScreen } from '@/components/journey/lovable/workspace-provisioning-screen';

export function ProvisioningPageClient() {
  const searchParams = useSearchParams();
  const isBuildStep = searchParams?.get('build') === '1';

  if (isBuildStep) {
    return <WorkspaceProvisioningScreen />;
  }

  return <WorkspaceCreateScreen />;
}
