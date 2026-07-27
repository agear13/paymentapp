import { Suspense } from 'react';
import { ProvisioningPageClient } from '@/components/journey/lovable/provisioning-page-client';

export default function JourneyProvisioningPage() {
  return (
    <Suspense fallback={null}>
      <ProvisioningPageClient />
    </Suspense>
  );
}
