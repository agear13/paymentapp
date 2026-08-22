import { Suspense } from 'react';
import { WorkspaceSettlementScreen } from '@/components/journey/lovable/workspace-settlement-screen';

export default function WorkspaceSettlementObligationsPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-ink-soft">Loading settlement…</p>}>
      <WorkspaceSettlementScreen section="obligations" />
    </Suspense>
  );
}
