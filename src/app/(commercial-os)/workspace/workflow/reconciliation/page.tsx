import { Suspense } from 'react';
import { WorkflowReconciliationScreen } from '@/components/journey/lovable/workflow-reconciliation-screen';

export default function WorkflowReconciliationPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowReconciliationScreen />
    </Suspense>
  );
}
