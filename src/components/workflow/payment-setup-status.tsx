'use client';

import { Check, Circle, Dot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceActivation } from '@/hooks/use-workspace-activation';
import { analyseWorkspace } from '@/components/workflow/commercial-decision-engine';

/* ─── Journey steps ─── */

type JourneyStep = {
  id: string;
  label: string;
};

const PAYMENT_JOURNEY: JourneyStep[] = [
  { id: 'workspace',   label: 'Business created' },
  { id: 'agreement',   label: 'Agreement prepared' },
  { id: 'earnings',    label: 'Earnings configured' },
  { id: 'payments',    label: 'Payments enabled' },
  { id: 'ready',       label: 'Ready to collect' },
  { id: 'live',        label: 'Live' },
];

function stepStatus(
  stepId: string,
  activation: ReturnType<typeof useWorkspaceActivation>['activation']
): 'done' | 'current' | 'future' {
  if (!activation) return stepId === 'workspace' ? 'current' : 'future';

  const {
    workspaceCreated,
    projectCreated,
    participantsConfigured,
    providerConnected,
    releaseEligible,
    firstReleaseCompleted,
  } = activation;

  switch (stepId) {
    case 'workspace':
      return workspaceCreated ? 'done'
        : 'current';
    case 'agreement':
      if (!workspaceCreated) return 'future';
      return projectCreated ? 'done' : 'current';
    case 'earnings':
      if (!projectCreated) return 'future';
      return participantsConfigured ? 'done' : 'current';
    case 'payments':
      if (!participantsConfigured) return 'future';
      return providerConnected ? 'done' : 'current';
    case 'ready':
      if (!providerConnected) return 'future';
      return releaseEligible ? 'done' : 'current';
    case 'live':
      if (!releaseEligible) return 'future';
      return firstReleaseCompleted ? 'done' : 'current';
    default:
      return 'future';
  }
}

/* ─── PaymentSetupStatus ─── */

/**
 * Clean payment setup status — the operator-facing view on /settings/merchant.
 *
 * Replaces the duplicated WorkspaceActivationBanner + OperationalSettlementInitialization
 * checklists with a single clear view:
 *
 *   Current status
 *   Customer payments are not yet enabled.
 *
 *   Remaining work
 *   • Connect Stripe
 *   • Request participant approvals
 *
 *   Estimated work: 4 minutes
 *
 *   Commercial journey
 *   ✓ Business created  ✓ Agreement prepared  ● Payments  ○ Ready  ○ Live
 */
export function PaymentSetupStatus() {
  const { activation, loading } = useWorkspaceActivation();

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-white/60 px-5 py-5 space-y-3 animate-pulse">
        <div className="h-3 w-32 bg-muted/60 rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
        <div className="space-y-1.5">
          <div className="h-3 w-1/2 bg-muted/60 rounded" />
          <div className="h-3 w-2/5 bg-muted/40 rounded" />
        </div>
      </div>
    );
  }

  // Derive remaining work from activation snapshot
  const remaining: { label: string; minutes: number }[] = [];

  if (activation) {
    const decision = analyseWorkspace({
      projectId: activation.primaryProjectId ?? 'workspace',
      kpis: {
        participantCount: activation.participantCount,
        earningsConfiguredCount: activation.participantsConfiguredCount,
        payoutReadyCount: activation.releaseEligibleCount,
        approvedAgreementCount: activation.participantCount, // rough proxy
        fundedObligationCount: activation.obligationCount,
        releaseEligibleCount: activation.releaseEligibleCount,
        attributionActiveCount: 0,
        obligationCount: activation.obligationCount,
        participantsConfigured: activation.participantsConfigured,
      },
      releaseConfidence: null,
      workspaceContext: null,
      activation,
    });

    for (const item of decision.priorityQueue.slice(0, 4)) {
      remaining.push({ label: item.title, minutes: item.estimatedMinutes });
    }
  }

  const totalMinutes = remaining.reduce((s, r) => s + r.minutes, 0);
  const providerConnected = activation?.providerConnected ?? false;
  const allDone = remaining.length === 0 || providerConnected;

  const statusSentence = allDone
    ? 'Your payment setup is complete.'
    : 'Customer payments are not yet enabled.';

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-5 py-5 space-y-5">
      {/* Current status */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">
          Current status
        </p>
        <p className={cn(
          'text-sm font-semibold',
          allDone ? 'text-[rgb(29,111,66)]' : 'text-foreground'
        )}>
          {statusSentence}
        </p>
      </div>

      {/* Remaining work */}
      {!allDone && remaining.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
            Remaining work
          </p>
          <ul className="space-y-1.5">
            {remaining.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Circle className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/50 shrink-0" aria-hidden />
                <span className="text-foreground/80">{item.label}</span>
              </li>
            ))}
          </ul>
          {totalMinutes > 0 ? (
            <p className="text-xs text-muted-foreground mt-3">
              Estimated work:{' '}
              <span className="font-medium text-foreground">{totalMinutes} minutes</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Commercial journey */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
          Commercial journey
        </p>
        <div className="flex items-center gap-0 flex-wrap">
          {PAYMENT_JOURNEY.map((step, i) => {
            const status = stepStatus(step.id, activation ?? null);
            return (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center gap-1.5 py-1 px-2">
                  {status === 'done' ? (
                    <div className="h-4 w-4 rounded-full bg-[rgb(29,111,66)] flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} aria-hidden />
                    </div>
                  ) : status === 'current' ? (
                    <div className="h-4 w-4 rounded-full border-2 border-[rgb(124,92,255)] bg-[rgba(124,92,255,0.1)] flex items-center justify-center shrink-0">
                      <Dot className="h-3 w-3 text-[rgb(124,92,255)]" aria-hidden />
                    </div>
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border/40 shrink-0" />
                  )}
                  <span
                    className={cn(
                      'text-xs whitespace-nowrap',
                      status === 'done' && 'text-muted-foreground line-through decoration-muted-foreground/40',
                      status === 'current' && 'font-semibold text-[rgb(124,92,255)]',
                      status === 'future' && 'text-muted-foreground/50'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < PAYMENT_JOURNEY.length - 1 ? (
                  <div className="h-px w-3 bg-border/40 shrink-0" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
