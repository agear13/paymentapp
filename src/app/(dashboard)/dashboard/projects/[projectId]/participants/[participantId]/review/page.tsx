'use client';

import { useParams } from 'next/navigation';
import { SupplierOnboardingReviewScreen } from '@/components/commercial/supplier-onboarding/supplier-onboarding-review-screen';
import {
  projectSupplierOnboardingPath,
  projectXeroExportPath,
} from '@/lib/projects/project-routes';

/**
 * Operator Supplier Onboarding Review Page
 *
 * Route: /dashboard/projects/[projectId]/participants/[participantId]/review
 */
export default function SupplierOnboardingReviewPage() {
  const params = useParams<{ projectId: string; participantId: string }>();
  const participantId = params?.participantId ?? '';
  const projectId = params?.projectId ?? '';

  return (
    <SupplierOnboardingReviewScreen
      participantId={participantId}
      backHref={projectSupplierOnboardingPath(projectId)}
      accountingHref={projectXeroExportPath(projectId)}
    />
  );
}
