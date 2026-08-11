import { Suspense } from 'react';
import { WorkspaceLayout } from '@/components/journey/lovable/workspace-layout';
import { WorkspaceReadinessShell } from '@/components/journey/lovable/workspace-readiness-shell';
import { BillingCheckoutSuccessHandler } from '@/components/billing/billing-checkout-success-handler';

export default function CommercialWorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceReadinessShell>
      <Suspense fallback={null}>
        <BillingCheckoutSuccessHandler />
      </Suspense>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </WorkspaceReadinessShell>
  );
}
