'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { CommercialWorkspaceSection } from '@/lib/participant-portal/participant-portal-types';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';
import { PortalStatusBadge } from '@/components/participant-portal/status-badge';
import { CommercialSummaryCard } from '@/components/participant-portal/commercial-summary-card';
import { PaymentTimeline } from '@/components/participant-portal/payment-timeline';
import { AgreementOverview } from '@/components/participant-portal/agreement-overview';
import { CommercialIntelligence } from '@/components/participant-portal/commercial-intelligence';
import { CommercialLifecycleCard } from '@/components/commercial/workspace/commercial-lifecycle-card';
import { CommercialMetricsGrid } from '@/components/commercial/workspace/commercial-metrics-grid';
import { CommercialPerformanceCard } from '@/components/commercial/workspace/commercial-metrics-grid';
import { SettlementExplanationCard } from '@/components/commercial/workspace/settlement-explanation-card';
import { CommercialWorkspaceNav } from '@/components/commercial/workspace/commercial-workspace-nav';
import { Button } from '@/components/ui/button';

type Props = {
  workspace: ParticipantCommercialWorkspaceModel;
  activeSection: CommercialWorkspaceSection;
  onSectionChange: (section: CommercialWorkspaceSection) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onboarding?: ParticipantWorkspaceOnboarding;
};

function formatSyncedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function EarningsMetrics({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  const earningsMetrics = workspace.performance.metrics.filter((m) =>
    ['current_earnings', 'pending_settlement', 'paid_to_date'].includes(m.field)
  );
  if (earningsMetrics.length === 0) return null;
  return <CommercialMetricsGrid metrics={earningsMetrics} title="Earnings" />;
}

function OverviewSection({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  return (
    <div className="space-y-6">
      <CommercialLifecycleCard steps={workspace.lifecycleSteps} />
      <CommercialIntelligence explanation={workspace.intelligence} />
      <EarningsMetrics workspace={workspace} />
      <CommercialPerformanceCard
        metrics={workspace.performance.metrics}
        hasRecordedActivity={workspace.performance.hasRecordedActivity}
      />
      <SettlementExplanationCard settlement={workspace.settlement} />
      <CommercialSummaryCard sections={workspace.commercialSections} />
    </div>
  );
}

function TermsSection({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  const hasTerms =
    workspace.commercialSections.length > 0 ||
    workspace.agreement.deliverables.length > 0 ||
    workspace.agreement.commercialObligations.length > 0;

  if (!hasTerms) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Commercial terms will appear once the organiser configures your agreement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CommercialSummaryCard sections={workspace.commercialSections} />
      <AgreementOverview agreement={workspace.agreement} />
    </div>
  );
}

function PaymentsSection({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  return (
    <div className="space-y-6">
      <SettlementExplanationCard settlement={workspace.settlement} />
      <EarningsMetrics workspace={workspace} />
      <PaymentTimeline items={workspace.paymentTimeline} />
    </div>
  );
}

function ActivitySection({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  const hasActivity =
    workspace.performance.hasRecordedActivity || workspace.paymentTimeline.length > 0;

  if (!hasActivity) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No commercial activity has been recorded yet. Activity will appear here as sales,
          obligations, and settlements are recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CommercialPerformanceCard
        metrics={workspace.performance.metrics}
        hasRecordedActivity={workspace.performance.hasRecordedActivity}
      />
      <PaymentTimeline items={workspace.paymentTimeline} />
    </div>
  );
}

export function ParticipantCommercialWorkspaceView({
  workspace,
  activeSection,
  onSectionChange,
  onRefresh,
  isRefreshing = false,
  onboarding,
}: Props) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              P
            </div>
            <span className="font-semibold tracking-tight shrink-0">Provvypay</span>
          </div>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">
            {workspace.projectName}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-6">
        {onboarding?.step === 'payout_submitted' ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            Payout details submitted — your organiser is verifying them. No further action is required
            from you right now.
          </div>
        ) : onboarding?.onboardingComplete ? (
          <div className="rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
            Onboarding complete. This is your permanent workspace for agreement, earnings, and
            settlement activity.
          </div>
        ) : null}

        <section className="space-y-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {workspace.participantName}
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-1">
              {workspace.participantRole}
            </p>
            <p className="text-sm text-muted-foreground">{workspace.participantSubtitle}</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Agreement</span>
              <PortalStatusBadge
                label={workspace.agreementStatusLabel}
                status={workspace.agreementStatus}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Last updated {formatSyncedAt(workspace.syncedAt)}</span>
              {onRefresh ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  aria-label="Refresh commercial state"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              ) : null}
            </div>
          </div>
        </section>

        <CommercialWorkspaceNav active={activeSection} onChange={onSectionChange} />

        {activeSection === 'overview' ? <OverviewSection workspace={workspace} /> : null}
        {activeSection === 'terms' ? <TermsSection workspace={workspace} /> : null}
        {activeSection === 'payments' ? <PaymentsSection workspace={workspace} /> : null}
        {activeSection === 'activity' ? <ActivitySection workspace={workspace} /> : null}
      </main>

      <footer className="border-t mt-8 py-6 text-center text-xs text-muted-foreground">
        Your commercial workspace · Powered by Provvypay
      </footer>
    </div>
  );
}

/** @deprecated Use ParticipantCommercialWorkspaceView */
export const ParticipantPortalView = ParticipantCommercialWorkspaceView;
