'use client';

import { useParams } from 'next/navigation';
import { SupplierOnboardingFormScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-form-screen';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export default function CommercialWorkspaceOnboardPage() {
  const params = useParams<{ workspaceId: string; participantId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const participantId = params?.participantId ?? '';

  return (
    <SupplierOnboardingFormScreen
      participantId={participantId}
      backHref={COMMERCIAL_OS_ROUTES.arrangementPeopleFocus(workspaceId, 'onboarding')}
    />
  );
}
