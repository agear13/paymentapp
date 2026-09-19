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
import { ParticipantLogoutButton } from '@/components/participant-portal/participant-logout-button';
import { ParticipantWorkspaceConversionCta } from '@/components/participant-portal/participant-workspace-conversion-cta';
import { ParticipantInvoiceActivationCta } from '@/components/participant-portal/participant-invoice-activation-cta';
import { shouldShowParticipantWorkspaceConversionCta } from '@/lib/participants/source-participant-hint';
import { shouldShowParticipantInvoiceActivationCta } from '@/lib/invoices/participant-invoice-activation';

type Props = {
  workspace: ParticipantCommercialWorkspaceModel;
  activeSection: CommercialWorkspaceSection;
  onSectionChange: (section: CommercialWorkspaceSection) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onboarding?: ParticipantWorkspaceOnboarding;
  signedInEmail?: string | null;
  portalToken?: string;
  onSignOut?: () => void;
  sourceParticipantId?: string | null;
  convertedOrganizationId?: string | null;
  previewMode?: boolean;
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
  return <CommercialMetricsGrid metrics={earningsMetrics} title="This agreement" />;
}

function RelationshipHistoryCard({
  workspace,
}: {
  workspace: ParticipantCommercialWorkspaceModel;
}) {
  const history = workspace.relationshipEarnings;
  if (!history.totalLabel && !history.thisAgreementLabel) return null;
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your Provvy history
      </p>
      {history.totalLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Total relationship earnings</p>
          <p className="text-lg font-semibold tabular-nums">{history.totalLabel}</p>
        </div>
      ) : null}
      {history.thisAgreementLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">This agreement</p>
          <p className="text-sm font-medium tabular-nums">{history.thisAgreementLabel}</p>
        </div>
      ) : null}
      {history.previousActivityLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Previous activity</p>
          <p className="text-sm font-medium tabular-nums">{history.previousActivityLabel}</p>
        </div>
      ) : null}
    </div>
  );
}

function CurrentAgreementSummary({
  workspace,
}: {
  workspace: ParticipantCommercialWorkspaceModel;
}) {
  if (!workspace.currentAgreementPayoutLabel && !workspace.currentAgreementTotalLabel) {
    return null;
  }
  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your agreement
      </p>
      {workspace.currentAgreementPayoutLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Your payout</p>
          <p className="text-2xl font-semibold tabular-nums">
            {workspace.currentAgreementPayoutLabel}
          </p>
        </div>
      ) : null}
      {workspace.currentAgreementTotalLabel ? (
        <div>
          <p className="text-xs text-muted-foreground">Total agreement value</p>
          <p className="text-sm font-medium tabular-nums">{workspace.currentAgreementTotalLabel}</p>
        </div>
      ) : null}
    </div>
  );
}

function OverviewSection({ workspace }: { workspace: ParticipantCommercialWorkspaceModel }) {
  return (
    <div className="space-y-6">
      <CommercialLifecycleCard steps={workspace.lifecycleSteps} />
      <CommercialIntelligence explanation={workspace.intelligence} />
      <CurrentAgreementSummary workspace={workspace} />
      <EarningsMetrics workspace={workspace} />
      <RelationshipHistoryCard workspace={workspace} />
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
      <CurrentAgreementSummary workspace={workspace} />
      <EarningsMetrics workspace={workspace} />
      <RelationshipHistoryCard workspace={workspace} />
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
  signedInEmail,
  portalToken,
  onSignOut,
  sourceParticipantId = null,
  convertedOrganizationId = null,
  previewMode = false,
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
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-xs text-muted-foreground truncate hidden sm:block">
              {workspace.projectName}
            </p>
            {signedInEmail ? (
              <p className="text-xs text-muted-foreground truncate hidden md:block">{signedInEmail}</p>
            ) : null}
            {onSignOut || portalToken ? (
              <ParticipantLogoutButton token={portalToken} onSignedOut={onSignOut} />
            ) : null}
          </div>
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

        {shouldShowParticipantInvoiceActivationCta({
          onboardingComplete: Boolean(onboarding?.onboardingComplete),
          previewMode,
          sourceParticipantId,
        }) && sourceParticipantId ? (
          <ParticipantInvoiceActivationCta
            sourceParticipantId={sourceParticipantId}
            convertedOrganizationId={convertedOrganizationId}
            commercialSections={workspace.commercialSections}
          />
        ) : null}

        {shouldShowParticipantWorkspaceConversionCta({
          onboardingComplete: Boolean(onboarding?.onboardingComplete),
          previewMode,
          sourceParticipantId,
        }) && sourceParticipantId && !convertedOrganizationId ? (
          <ParticipantWorkspaceConversionCta sourceParticipantId={sourceParticipantId} />
        ) : null}

        <section className="space-y-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {workspace.projectName}
            </h1>
            {workspace.contractingParty ? (
              <p className="text-base sm:text-lg text-muted-foreground mt-1">
                {workspace.contractingParty} → {workspace.participantName}
              </p>
            ) : (
              <p className="text-base sm:text-lg text-muted-foreground mt-1">
                {workspace.participantName}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Your role · {workspace.participantRole}</p>
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
