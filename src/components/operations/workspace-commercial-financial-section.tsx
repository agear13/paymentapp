'use client';

/**
 * Workspace Commercial Financial Section
 *
 * Business Dashboard financial widgets — aggregates CommercialFinancialSnapshot
 * across all active projects. Project-specific resume work stays elsewhere.
 */

import * as React from 'react';
import { useBusinessFinancialSnapshot } from '@/hooks/use-business-financial-snapshot';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { CommercialPositionCards } from '@/components/operations/commercial-position-cards';
import { MoneyWaitingPanel } from '@/components/operations/money-waiting-panel';
import { BusinessSnapshotHero } from '@/components/operations/business-snapshot-hero';
import { WorkspaceHealthScore } from '@/components/operations/workspace-health-score';
import type { AgreementHealthPortfolioSummary } from '@/lib/agreements/health/agreement-health.types';
import type { AttentionItem } from '@/lib/operations/severity';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import type { QueueTask } from '@/components/operations/operational-queue';

type WorkspaceCommercialFinancialSectionProps = {
  agreementSnapshots: AgreementHealthSnapshot[];
  portfolio: AgreementHealthPortfolioSummary | null;
  attentionItems: AttentionItem[];
  coordinationLoading: boolean;
  workspaceContext: WorkspaceOperationalContext | null;
  activation: WorkspaceActivationSnapshot | null;
  priorities: QueueTask[];
};

export function WorkspaceCommercialFinancialSection({
  agreementSnapshots,
  portfolio,
  attentionItems,
  coordinationLoading,
  workspaceContext,
  activation,
  priorities,
}: WorkspaceCommercialFinancialSectionProps) {
  const { business, loading: businessLoading } = useBusinessFinancialSnapshot({
    healthSnapshots: agreementSnapshots,
    portfolio,
    priorities,
    currency: workspaceContext?.defaultCurrency ?? undefined,
    enabled: agreementSnapshots.length > 0,
  });

  const isLoading = coordinationLoading || businessLoading;
  const snapshot = business?.commercial ?? null;

  return (
    <>
      <CommercialPositionCards
        snapshot={snapshot}
        business={business}
        loading={isLoading}
      />

      <div className="grid gap-3 xl:grid-cols-[1fr_260px]">
        <BusinessSnapshotHero
          portfolio={portfolio}
          business={business}
          workspaceContext={workspaceContext}
          attentionItems={attentionItems}
          loading={isLoading}
        />
        {!isLoading ? (
          <WorkspaceHealthScore
            portfolio={portfolio}
            kpis={null}
            workspace={workspaceContext}
            releaseConfidence={null}
            activation={activation}
          />
        ) : null}
      </div>

      <MoneyWaitingPanel snapshot={snapshot} business={business} loading={isLoading} />
    </>
  );
}
