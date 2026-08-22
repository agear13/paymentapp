import { Suspense } from 'react';
import { WorkspaceSettlementScreen } from '@/components/journey/lovable/workspace-settlement-screen';

export default function WorkspaceSettlementEarningsPage() {
  return (
    <Suspense fallback={<p className="text-[13px] text-ink-soft">Loading settlement…</p>}>
      <WorkspaceSettlementScreen section="earnings" />
    </Suspense>
  );
}
