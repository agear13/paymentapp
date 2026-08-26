import { Suspense } from 'react';
import { CommercialWorkspacePeoplePanel } from '@/components/journey/lovable/commercial-workspace-people-panel';

export default function CommercialWorkspacePeoplePage() {
  return (
    <Suspense fallback={null}>
      <CommercialWorkspacePeoplePanel />
    </Suspense>
  );
}
