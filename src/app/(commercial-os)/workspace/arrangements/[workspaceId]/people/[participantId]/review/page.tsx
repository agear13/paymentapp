'use client';

import { useParams } from 'next/navigation';
import { SupplierOnboardingReviewScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-review-screen';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';

export default function CommercialWorkspaceReviewPage() {
  const params = useParams<{ workspaceId: string; participantId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const participantId = params?.participantId ?? '';

  return (
    <SupplierOnboardingReviewScreen
      participantId={participantId}
      backHref={COMMERCIAL_OS_ROUTES.arrangementPeopleFocus(workspaceId, 'onboarding')}
      accountingHref={COMMERCIAL_OS_ROUTES.arrangementMoneyAccounting(workspaceId)}
      accountingLinkLabel="View in Money"
    />
  );
}
