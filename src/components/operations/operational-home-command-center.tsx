'use client';

import { useOperationalGuidance } from '@/hooks/use-operational-guidance';
import { deriveOperationalSeverity } from '@/lib/operations/severity';
import { OperationalCommandCenterHero } from '@/components/operations/operational-command-center-hero';
import { OperationalAttentionBoard } from '@/components/operations/operational-attention-board';
import { RecentOperationalEvents } from '@/components/operations/recent-operational-events';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { ReleaseSimulationPreview } from '@/components/operations/release-simulation-preview';

/**
 * Home command center — live operational overview (replaces card-heavy home).
 */
export function OperationalHomeCommandCenter() {
  const { guidance, loading, workspaceContext, activation } = useOperationalGuidance();

  const attentionItems = deriveOperationalSeverity({
    guidance,
    workspace: workspaceContext,
    projectName: undefined,
  });

  const workspacePhase =
    activation?.phase === 'ready_for_release'
      ? 'ACTIVE'
      : activation?.phase === 'ready_to_coordinate'
        ? 'COORDINATING'
        : activation?.phase === 'ready_to_collect'
          ? 'COLLECTING'
          : 'CONFIGURING';

  return (
    <div className="space-y-10">
      <OperationalCommandCenterHero
        guidance={guidance}
        attentionItems={attentionItems}
        workspacePhase={workspacePhase}
        loading={loading}
      />

      <div className="space-y-6">
        <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} />
        <ReleaseSimulationPreview confidence={guidance.releaseConfidence} />
      </div>

      <OperationalAttentionBoard items={attentionItems} />

      <RecentOperationalEvents events={guidance.timeline} />
    </div>
  );
}
