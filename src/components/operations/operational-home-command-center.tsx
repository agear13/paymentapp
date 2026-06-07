'use client';

import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { useAgreementHealthPortfolio } from '@/hooks/use-agreement-health-portfolio';
import { deriveOperationalSeverity } from '@/lib/operations/severity';
import { deduplicateAttentionItems } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { OperationalCommandCenterHero } from '@/components/operations/operational-command-center-hero';
import { OperationalAttentionBoard } from '@/components/operations/operational-attention-board';
import { RecentOperationalEvents } from '@/components/operations/recent-operational-events';
import { OperationalAuditTimeline } from '@/components/operations/operational-audit-timeline';
import { AgreementHealthOverview } from '@/components/agreements/health/agreement-health-overview';
import { AgreementComparativeIntelligence } from '@/components/agreements/health/agreement-comparative-intelligence';
import { opPage } from '@/lib/design/operational-spacing';
import { opCollapsibleTrigger } from '@/lib/design/operational-surfaces';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function OperationalHomeCommandCenter() {
  const { guidance, loading, workspaceContext, activation, auditTimeline, kpis } =
    useOperationalCoordinationState({ traceSurface: 'operational-home-command-center' });
  const { portfolio, snapshots, loading: healthLoading } = useAgreementHealthPortfolio();
  const primaryAction = guidance.actions[0] ?? null;

  const attentionItems = deduplicateAttentionItems(
    deriveOperationalSeverity({
      guidance,
      workspace: workspaceContext,
      projectName: undefined,
      kpis,
    }),
    {
      primaryActionLabel: primaryAction?.action ?? null,
      primaryActionHref: primaryAction?.destination ?? null,
      maxCritical: 3,
      maxPerSeverity: 3,
    }
  );

  const workspacePhase =
    activation?.phase === 'ready_for_release'
      ? 'ACTIVE'
      : activation?.phase === 'ready_to_coordinate'
        ? 'COORDINATING'
        : activation?.phase === 'ready_to_collect'
          ? 'COLLECTING'
          : 'CONFIGURING';

  return (
    <div className={opPage()}>
      <AgreementHealthOverview portfolio={portfolio} loading={healthLoading} />

      <OperationalCommandCenterHero
        guidance={guidance}
        attentionItems={attentionItems}
        workspacePhase={workspacePhase}
        loading={loading}
      />

      <OperationalAttentionBoard items={attentionItems} calmMode />

      {snapshots.length > 1 ? (
        <AgreementComparativeIntelligence snapshots={snapshots} loading={healthLoading} />
      ) : null}

      <Collapsible>
        <CollapsibleTrigger className={opCollapsibleTrigger}>
          Recent activity
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
          <div className="surface-agreement-card p-4">
            {auditTimeline.length > 0 ? (
              <OperationalAuditTimeline entries={auditTimeline} />
            ) : guidance.timeline.length > 0 ? (
              <RecentOperationalEvents events={guidance.timeline} compact />
            ) : (
              <RecentOperationalEvents events={guidance.timeline} compact />
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
