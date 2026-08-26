import { Suspense } from 'react';
import { CommercialWorkspaceMoneyPanel } from '@/components/journey/lovable/commercial-workspace-money-panel';

export default function CommercialWorkspaceMoneyPage() {
  return (
    <Suspense fallback={null}>
      <CommercialWorkspaceMoneyPanel />
    </Suspense>
  );
}
