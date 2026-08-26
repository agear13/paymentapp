'use client';

import { useParams } from 'next/navigation';
import { SupplierOnboardingFormScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-form-screen';
import { projectSupplierOnboardingPath } from '@/lib/projects/project-routes';

/**
 * Participant Supplier Onboarding Form Page
 *
 * Route: /dashboard/projects/[projectId]/participants/[participantId]/onboard
 */
export default function SupplierOnboardingPage() {
  const params = useParams<{ projectId: string; participantId: string }>();
  const participantId = params?.participantId ?? '';
  const projectId = params?.projectId ?? '';

  return (
    <SupplierOnboardingFormScreen
      participantId={participantId}
      backHref={projectSupplierOnboardingPath(projectId)}
    />
  );
}
