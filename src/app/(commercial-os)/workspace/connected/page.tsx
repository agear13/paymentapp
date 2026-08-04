import { Suspense } from 'react';
import { WorkspaceConnectedScreen } from '@/components/journey/lovable/workspace-connected-screen';

export default function WorkspaceConnectedPage() {
  return (
    <Suspense fallback={null}>
      <WorkspaceConnectedScreen />
    </Suspense>
  );
}
