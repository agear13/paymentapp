'use client';

import Link from 'next/link';
import { ArrowRight, Check, Circle, CircleDollarSign, FileCheck, History, ChevronDown } from 'lucide-react';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';
import { OperationalSettlementInitialization } from '@/components/operations/operational-settlement-initialization';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { deriveWorkflowContext } from '@/components/workflow/workflow-context';
import { resolveAgreementDestination, getStageConsequences } from '@/components/workflow/workflow-navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import {
  PAYOUTS_COMMISSIONS_HREF,
  PAYOUTS_OBLIGATIONS_HREF,
  PAYOUTS_SETTLEMENTS_HREF,
} from '@/lib/navigation/operator-nav';
import { opPage } from '@/lib/design/operational-spacing';

/* ─── Settlement area navigation ─── */

const SETTLEMENT_LINKS = [
  { title: 'What is owed', description: 'Payment obligations for each team member', href: PAYOUTS_OBLIGATIONS_HREF, icon: FileCheck },
  { title: 'Earnings & approvals', description: 'Participant earnings and readiness status', href: PAYOUTS_COMMISSIONS_HREF, icon: CircleDollarSign },
  { title: 'Past releases', description: 'Completed payout batches and history', href: PAYOUTS_SETTLEMENTS_HREF, icon: History },
] as const;

/* ─── Journey display ─── */

const JOURNEY_STEPS = [
  { id: 'agreement',  label: 'Agreement prepared' },
  { id: 'team',       label: 'Team configured' },
  { id: 'earnings',   label: 'Earnings configured' },
  { id: 'payments',   label: 'Payments enabled' },
  { id: 'settlement', label: 'Settlement ready' },
  { id: 'live',       label: 'Live' },
] as const;

type JourneyStepId = typeof JOURNEY_STEPS[number]['id'];

function resolveJourneyStage(stage: string): JourneyStepId {
  switch (stage) {
    case 'setup': return 'agreement';
    case 'configuring': return 'team';
    case 'collecting-approvals': return 'earnings';
    case 'preparing-payments': return 'payments';
    case 'ready-to-collect':
    case 'collecting-revenue': return 'settlement';
    case 'ready-to-release':
    case 'operational': return 'live';
    default: return 'agreement';
  }
}

const STEP_ORDER: JourneyStepId[] = ['agreement', 'team', 'earnings', 'payments', 'settlement', 'live'];

function stepStatus(stepId: JourneyStepId, currentStep: JourneyStepId): 'done' | 'current' | 'future' {
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const stepIdx = STEP_ORDER.indexOf(stepId);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'future';
}

/* ─── Status sentence ─── */

function buildStatusSentence(
  stage: string,
  readyToRelease: number,
  blockerCount: number
): string {
  if (stage === 'operational') return 'Settlement is fully operational.';
  if (readyToRelease > 0) return 'Payouts are ready to release.';
  if (stage === 'ready-to-collect') return 'Ready to begin collecting revenue.';
  if (stage === 'preparing-payments') return 'Settlement is waiting. Connect a payment provider to proceed.';
  if (stage === 'collecting-approvals') {
    return blockerCount === 1
      ? 'Settlement is waiting for one team member approval.'
      : `Settlement is waiting for ${blockerCount} team member approvals.`;
  }
  if (stage === 'configuring') return 'Configure team earnings to progress toward settlement.';
  return 'Continue setup to reach commercial readiness.';
}

/* ─── Hub content ─── */

function PayoutsHubContent() {
  const {
    guidance,
    workspaceContext,
    activation,
    kpis,
  } = useOperationalCoordinationState({ traceSurface: 'payouts-hub-page' });

  const projectId = activation?.primaryProjectId ?? 'workspace';

  const wfCtx = deriveWorkflowContext({
    projectId,
    kpis: kpis ?? null,
    releaseConfidence: guidance.releaseConfidence ?? null,
    workspaceContext: workspaceContext ?? null,
    activation: activation ?? null,
  });

  const readyToRelease = guidance.releaseConfidence?.readyToRelease ?? 0;
  const participantCount = kpis?.participantCount ?? 0;
  const approvedCount = kpis?.approvedAgreementCount ?? 0;
  const blockerCount = Math.max(0, participantCount - approvedCount);

  const statusSentence = buildStatusSentence(wfCtx.currentStage, readyToRelease, blockerCount);
  const isReady = wfCtx.isCompleted || readyToRelease > 0;

  // Resolve the single highest-priority action
  const actionIntent = readyToRelease > 0 ? 'release-payouts'
    : wfCtx.currentStage === 'preparing-payments' ? 'connect-provider'
    : wfCtx.currentStage === 'collecting-approvals' ? 'request-approvals'
    : wfCtx.currentStage === 'configuring' ? 'configure-earnings'
    : wfCtx.currentStage === 'collecting-revenue' ? 'review-obligations'
    : null;

  const action = actionIntent
    ? resolveAgreementDestination(actionIntent as Parameters<typeof resolveAgreementDestination>[0], projectId)
    : null;

  const consequences = getStageConsequences(wfCtx.currentStage);
  const currentJourneyStep = resolveJourneyStage(wfCtx.currentStage);

  return (
    <div className="space-y-5">
      {/* ── Section 1: Current Status ── */}
      <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-4 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Current status
        </p>
        <p className={cn(
          'text-sm font-semibold',
          isReady ? 'text-[rgb(29,111,66)]' : 'text-foreground'
        )}>
          {statusSentence}
        </p>
      </div>

      {/* ── Section 2: Single highest-priority action (only when there's work) ── */}
      {action && !wfCtx.isCompleted ? (
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/30 px-5 py-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700/70">
            Today&apos;s priority
          </p>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground leading-snug">{action.reason}</p>
          </div>
          {consequences.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Doing this enables
              </p>
              {consequences.slice(0, 3).map((c) => (
                <div key={c} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[rgb(29,111,66)] shrink-0" />
                  <span className="text-xs text-foreground/80">{c}</span>
                </div>
              ))}
            </div>
          ) : null}
          {action.estimatedMinutes > 0 ? (
            <p className="text-xs text-muted-foreground">
              Estimated time:{' '}
              <span className="font-medium text-foreground">{action.estimatedMinutes} minutes</span>
            </p>
          ) : null}
          <Button asChild size="sm" className="h-7 text-xs bg-foreground hover:bg-foreground/90 text-background border-0">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </div>
      ) : null}

      {/* ── Section 3: Commercial journey ── */}
      <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Commercial journey
        </p>
        <div className="flex items-center gap-0 flex-wrap">
          {JOURNEY_STEPS.map((step, i) => {
            const status = stepStatus(step.id as JourneyStepId, currentJourneyStep);
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-1.5 py-1 px-1.5">
                  {status === 'done' ? (
                    <div className="h-4 w-4 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                    </div>
                  ) : status === 'current' ? (
                    <div className="h-4 w-4 rounded-full border-2 border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.1)] flex items-center justify-center shrink-0">
                      <div className="h-1.5 w-1.5 rounded-full bg-[rgb(124,92,255)]" />
                    </div>
                  ) : (
                    <Circle className="h-4 w-4 text-border/50 shrink-0" />
                  )}
                  <span className={cn(
                    'text-xs whitespace-nowrap',
                    status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40',
                    status === 'current' && 'font-semibold text-[rgb(124,92,255)]',
                    status === 'future' && 'text-muted-foreground/50'
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < JOURNEY_STEPS.length - 1 ? (
                  <div className="h-px w-3 bg-border/30 shrink-0" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section 4: Settlement area navigation ── */}
      <div className="rounded-xl border border-border/60 bg-white/70 overflow-hidden">
        {SETTLEMENT_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors',
              i > 0 && 'border-t border-border/40'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <link.icon className="h-4 w-4 text-muted-foreground/60 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{link.title}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
          </Link>
        ))}
      </div>

      {/* ── Section 5: Recent business activity (progressive disclosure) ── */}
      <Collapsible>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-white/70 px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted/20 transition-colors">
          Recent business activity
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <OperationalActivitySection
            title=""
            emptyMessage="Business milestones appear here as settlement activity is recorded."
            defaultOpen
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/* ─── Main export ─── */

export function PayoutsHubPage() {
  const {
    loading,
    operationalOnboarding,
    operationalInitialization,
    graphSnapshotConverged,
    kpis,
    activation,
    guidance,
  } = useOperationalCoordinationState({ traceSurface: 'payouts-hub-page' });

  return (
    <ProjectSectionErrorBoundary sectionTitle="Settlement" boundaryScope="payouts">
      <div className={opPage()}>

        {/* Page header */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settlement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track obligations, manage team approvals, and release payouts when revenue is ready.
          </p>
        </div>

        {/* Initialization gate — only shown before business setup is complete */}
        <OperationalSettlementInitialization
          onboarding={operationalOnboarding}
          initialization={operationalInitialization}
          loading={loading}
          graphSnapshotConverged={graphSnapshotConverged}
          nextActions={guidance.actions.slice(0, 2)}
          participantCount={kpis?.participantCount ?? activation?.participantCount}
          earningsConfiguredCount={
            kpis?.earningsConfiguredCount ?? activation?.participantsConfiguredCount
          }
          obligationCount={kpis?.obligationCount ?? activation?.obligationCount}
        >
          <PayoutsHubContent />
        </OperationalSettlementInitialization>

      </div>
    </ProjectSectionErrorBoundary>
  );
}
