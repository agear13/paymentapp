import { Suspense } from 'react';
import { WorkspaceSettlementObligationDetailScreen } from '@/components/journey/lovable/workspace-settlement-screen';

export default async function WorkspaceSettlementObligationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p className="text-[13px] text-ink-soft">Loading settlement…</p>}>
      <WorkspaceSettlementObligationDetailScreen obligationId={decodeURIComponent(id)} />
    </Suspense>
  );
}
