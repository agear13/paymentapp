'use client';

import Link from 'next/link';
import { ArrowRight, CircleDollarSign, FileCheck, History } from 'lucide-react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import type { useOperationalCoordinationState as UseOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { deduplicateAttentionItems } from '@/lib/operations/explainability/deduplicate-operational-actions';
import { deriveOperationalSeverity } from '@/lib/operations/severity';
import { ReleaseConfidenceSummary } from '@/components/operations/release-confidence-summary';
import { OperationalAttentionBoard } from '@/components/operations/operational-attention-board';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { SafeOperationalLink } from '@/components/operations/safe-operational-link';
import { PayoutHowItWorksCard } from '@/components/payouts/payout-lifecycle-explainer';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { OperationalTimeline } from '@/components/operations/operational-timeline';
import { opTypeBodySnug, opTypePageTitle } from '@/lib/design/operational-typography';
import { opPage } from '@/lib/design/operational-spacing';
import { opCollapsibleTrigger, opDivider, opSurface } from '@/lib/design/operational-surfaces';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';

const HUB_LINKS = [
  { title: 'Obligations', href: PAYOUTS_OBLIGATIONS_HREF, icon: FileCheck },
  { title: 'Participant earnings', href: PAYOUTS_COMMISSIONS_HREF, icon: CircleDollarSign },
  { title: 'Payout releases', href: PAYOUTS_SETTLEMENTS_HREF, icon: History },
] as const;

function PayoutsHubContent({
  guidance,
  workspaceContext,
  activation,
  kpis,
}: {
  guidance: ReturnType<UseOperationalCoordinationState>['guidance'];
  workspaceContext: ReturnType<UseOperationalCoordinationState>['workspaceContext'];
  activation: ReturnType<UseOperationalCoordinationState>['activation'];
  kpis: ReturnType<UseOperationalCoordinationState>['kpis'];
}) {
  const primary = guidance.actions[0];

  const attentionItems = deduplicateAttentionItems(
    deriveOperationalSeverity({ guidance, workspace: workspaceContext, kpis }),
    {
      primaryActionLabel: primary?.action,
      primaryActionHref: primary?.destination,
      maxPerSeverity: 2,
      maxCritical: 2,
    }
  );

  return (
    <>
      <div className={opSurface('raised', 'space-y-3')}>
        <ReleaseConfidenceSummary confidence={guidance.releaseConfidence} compact calmMode />
        {primary ? (
          <SafeOperationalLink
            intent={
              /earnings/i.test(primary.action) ? 'configure_earnings' : 'review_obligations'
            }
            projectId={activation?.primaryProjectId}
            className="inline-flex items-center text-sm font-medium text-primary hover:underline transition-colors duration-150"
          >
            {primary.ctaLabel ?? primary.action}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </SafeOperationalLink>
        ) : null}
      </div>

      {attentionItems.length > 0 ? (
        <OperationalAttentionBoard items={attentionItems} calmMode />
      ) : null}

      <nav className={cn('divide-y', opDivider)} aria-label="Payout sections">
        {HUB_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between gap-2 py-2.5 transition-colors duration-150 hover:text-foreground"
          >
            <span className="text-sm font-medium flex items-center gap-2 text-foreground/90">
              <link.icon className="h-4 w-4 text-foreground/55" />
              {link.title}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-foreground/45 group-hover:translate-x-0.5 transition-transform duration-150" />
          </Link>
        ))}
      </nav>

      <Collapsible>
        <CollapsibleTrigger className={opCollapsibleTrigger}>
          How payouts work
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 data-[state=open]:animate-in data-[state=closed]:animate-out duration-200">
          <PayoutHowItWorksCard />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible>
        <CollapsibleTrigger className={opCollapsibleTrigger}>
          Coordination timeline
          <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 data-[state=open]:animate-in data-[state=closed]:animate-out duration-200">
          <OperationalTimeline events={guidance.timeline} maxItems={6} />
        </CollapsibleContent>
      </Collapsible>

      <OperationalActivitySection
        title="Payout activity"
        emptyMessage="Release, funding, and coordination events appear here as payouts progress."
        defaultOpen={false}
      />
    </>
  );
}

export function PayoutsHubPage() {
  const {
    guidance,
    workspaceContext,
    activation,
    loading,
    operationalOnboarding,
    operationalInitialization,
    graphSnapshotConverged,
    kpis,
  } = useOperationalCoordinationState({ traceSurface: 'payouts-hub-page' });

  return (
    <ProjectSectionErrorBoundary sectionTitle="Payouts" boundaryScope="payouts">
      <div className={opPage()}>
        <header>
          <h1 className={opTypePageTitle}>Payouts</h1>
          <p className={cn(opTypeBodySnug, 'mt-1 max-w-xl')}>
            Coordinate what is owed, what is ready, and what has been released.
          </p>
        </header>

        <OperationalSettlementInitialization
          onboarding={operationalOnboarding}
          initialization={operationalInitialization}
          loading={loading}
          graphSnapshotConverged={graphSnapshotConverged}
          nextActions={guidance.actions.slice(0, 3)}
          participantCount={kpis?.participantCount ?? activation?.participantCount}
          earningsConfiguredCount={
            kpis?.earningsConfiguredCount ?? activation?.participantsConfiguredCount
          }
          obligationCount={kpis?.obligationCount ?? activation?.obligationCount}
        >
          <div className="space-y-6">
            <PayoutsHubContent
              guidance={guidance}
              workspaceContext={workspaceContext}
              activation={activation}
              kpis={kpis}
            />
          </div>
        </OperationalSettlementInitialization>
      </div>
    </ProjectSectionErrorBoundary>
  );
}
