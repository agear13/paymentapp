'use client';

/**
 * Workspace Commercial Financial Section
 *
 * Renders dashboard financial widgets as a projection of agreement state.
 * Loads authoritative treasury/funding/obligations for the primary agreement
 * and passes treasury into coordination state so release confidence reflects
 * real money — never count-based proxies.
 */

import * as React from 'react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { loadCommercialFinancialInputs } from '@/lib/commercial/load-commercial-financial-inputs';
import {
  deriveCommercialFinancialSnapshot,
  type CommercialFinancialSnapshot,
} from '@/lib/commercial/commercial-financial-snapshot';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { CommercialPositionCards } from '@/components/operations/commercial-position-cards';
import { MoneyWaitingPanel } from '@/components/operations/money-waiting-panel';
import { BusinessSnapshotHero } from '@/components/operations/business-snapshot-hero';
import { WorkspaceHealthScore } from '@/components/operations/workspace-health-score';
import type { AgreementHealthPortfolioSummary } from '@/lib/agreements/health/agreement-health.types';
import type { AttentionItem } from '@/lib/operations/severity';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { BriefingObligationRowInput } from '@/lib/agreements/agreement-briefing.model';
import type {
  ProjectFundingSourceDto,
  ProjectTreasurySummary,
} from '@/lib/projects/funding-sources/types';

type WorkspaceCommercialFinancialSectionProps = {
  primaryProjectId: string | null;
  agreementSnapshots: AgreementHealthSnapshot[];
  portfolio: AgreementHealthPortfolioSummary | null;
  attentionItems: AttentionItem[];
  coordinationLoading: boolean;
  workspaceContext: WorkspaceOperationalContext | null;
  activation: WorkspaceActivationSnapshot | null;
};

export function WorkspaceCommercialFinancialSection({
  primaryProjectId,
  agreementSnapshots,
  portfolio,
  attentionItems,
  coordinationLoading,
  workspaceContext,
  activation,
}: WorkspaceCommercialFinancialSectionProps) {
  const primaryAgreement = React.useMemo(
    () =>
      agreementSnapshots.find((s) => s.projectId === primaryProjectId) ??
      agreementSnapshots[0] ??
      null,
    [agreementSnapshots, primaryProjectId]
  );

  const dealId = primaryAgreement?.projectId ?? primaryProjectId;

  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);
  const [fundingSources, setFundingSources] = React.useState<ProjectFundingSourceDto[]>([]);
  const [obligationRows, setObligationRows] = React.useState<BriefingObligationRowInput[]>([]);
  const [inputsLoading, setInputsLoading] = React.useState(true);

  const loadInputs = React.useCallback(async () => {
    if (!primaryProjectId || !dealId) {
      setTreasury(null);
      setFundingSources([]);
      setObligationRows([]);
      setInputsLoading(false);
      return;
    }

    setInputsLoading(true);
    try {
      const inputs = await loadCommercialFinancialInputs(primaryProjectId, dealId);
      setTreasury(inputs.treasury);
      setFundingSources(inputs.fundingSources);
      setObligationRows(inputs.obligationRows);
    } catch {
      setTreasury(null);
      setFundingSources([]);
      setObligationRows([]);
    } finally {
      setInputsLoading(false);
    }
  }, [primaryProjectId, dealId]);

  React.useEffect(() => {
    void loadInputs();
  }, [loadInputs]);

  const { guidance, kpis, loading: coordinationWithTreasuryLoading } =
    useOperationalCoordinationState({
      treasury: treasury ?? undefined,
      enabled: Boolean(primaryProjectId),
      traceSurface: 'workspace-commercial-financial-section',
    });

  const currency =
    treasury?.currency ?? guidance.releaseConfidence?.currency ?? 'AUD';

  const snapshot = React.useMemo<CommercialFinancialSnapshot | null>(() => {
    if (!primaryProjectId || !dealId) return null;

    return deriveCommercialFinancialSnapshot({
      projectId: primaryProjectId,
      dealId,
      fundingSources,
      treasury,
      obligationRows,
      releaseConfidence: guidance.releaseConfidence ?? null,
      currency,
      kpis: kpis ?? null,
    });
  }, [
    primaryProjectId,
    dealId,
    fundingSources,
    treasury,
    obligationRows,
    guidance.releaseConfidence,
    currency,
    kpis,
  ]);

  const isLoading =
    coordinationLoading || inputsLoading || coordinationWithTreasuryLoading;

  return (
    <>
      <CommercialPositionCards
        snapshot={snapshot}
        loading={isLoading}
        projectId={primaryProjectId ?? undefined}
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
        <BusinessSnapshotHero
          portfolio={portfolio}
          snapshot={snapshot}
          kpis={kpis}
          attentionItems={attentionItems}
          loading={isLoading}
        />
        {!isLoading ? (
          <WorkspaceHealthScore
            portfolio={portfolio}
            kpis={kpis}
            workspace={workspaceContext}
            releaseConfidence={guidance.releaseConfidence}
            activation={activation}
          />
        ) : null}
      </div>

      <MoneyWaitingPanel snapshot={snapshot} loading={isLoading} />
    </>
  );
}
