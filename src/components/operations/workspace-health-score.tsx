'use client';

import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgreementHealthPortfolioSummary } from '@/lib/agreements/health/agreement-health.types';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { WorkspaceActivationSnapshot } from '@/lib/onboarding/workspace-activation-types';
import { deriveCommercialCapabilities } from '@/components/workflow/commercial-decision-engine';

type WorkspaceHealthScoreProps = {
  portfolio: AgreementHealthPortfolioSummary | null;
  kpis: OperationalKPIs | null | undefined;
  workspace: WorkspaceOperationalContext | null;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  activation: WorkspaceActivationSnapshot | null | undefined;
  loading?: boolean;
};

type HealthSignal = {
  label: string;
  done: boolean;
};

function humanInterpretation(score: number, blockerCount: number): string {
  if (score >= 95) return 'Ready to operate.';
  if (score >= 80) {
    return blockerCount === 1
      ? 'Almost ready. One thing preventing money from flowing.'
      : `Almost ready. ${blockerCount} things preventing money from flowing.`;
  }
  if (score >= 55) {
    return blockerCount === 1
      ? 'Making progress. One thing still to complete.'
      : `Making progress. ${blockerCount} things still to complete.`;
  }
  return 'Just getting started. Complete the essentials first.';
}

/**
 * Single workspace readiness percentage.
 *
 * Signals are derived using deriveCommercialCapabilities — the same function
 * the Commercial Decision Engine uses. This guarantees that the health score
 * never disagrees with any other completion indicator in the product.
 */
export function WorkspaceHealthScore({
  portfolio,
  kpis,
  workspace,
  releaseConfidence,
  activation,
  loading,
}: WorkspaceHealthScoreProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-4 space-y-3 animate-pulse">
        <div className="h-3 w-28 bg-muted rounded" />
        <div className="h-8 w-16 bg-muted rounded" />
      </div>
    );
  }

  if (!workspace?.hasOrganization && !activation?.workspaceCreated) return null;

  // Derive capabilities from the same engine used everywhere else.
  // Zero independent business logic here.
  const caps = deriveCommercialCapabilities({
    kpis: kpis ?? null,
    releaseConfidence: releaseConfidence ?? null,
    workspaceContext: workspace ?? null,
    activation: activation ?? null,
  });

  const signals: HealthSignal[] = [
    {
      label: 'Business created',
      done: workspace?.hasOrganization ?? activation?.workspaceCreated ?? false,
    },
    {
      label: 'Agreement created',
      done: activation?.projectCreated ?? (portfolio?.totalAgreements ?? 0) > 0,
    },
    { label: 'Participants invited',      done: caps.participantsInvited },
    { label: 'Earnings configured',       done: caps.earningsConfigured },
    { label: 'Approvals received',        done: caps.approvalsComplete },
    { label: 'Payment provider connected', done: caps.paymentProviderConnected },
    { label: 'Revenue flowing',           done: caps.revenueFlowing },
  ];

  const doneCount = signals.filter((s) => s.done).length;
  const blockerCount = signals.length - doneCount;
  const score = Math.round((doneCount / signals.length) * 100);

  const scoreColor =
    score >= 80
      ? 'text-[rgb(29,111,66)]'
      : score >= 50
        ? 'text-amber-700'
        : 'text-red-700';

  const barColor =
    score >= 80 ? 'bg-[rgb(29,111,66)]' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-border/60 bg-white/70 px-4 py-4 space-y-3">
      {/* Score + bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
            Business readiness
          </p>
          <p className={cn('text-3xl font-semibold mt-1', scoreColor)}>{score}%</p>
        </div>
        <div className="flex-1 max-w-[120px]">
          <div className="h-2 rounded-full bg-muted/40">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Human interpretation */}
      <p className="text-xs text-muted-foreground leading-snug">
        {humanInterpretation(score, blockerCount)}
      </p>

      {/* Checklist */}
      <ul className="grid grid-cols-1 gap-1">
        {signals.map((sig) => (
          <li key={sig.label} className="flex items-center gap-2 text-xs">
            {sig.done ? (
              <Check className="h-3 w-3 text-[rgb(29,111,66)] shrink-0" aria-hidden />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                sig.done ? 'text-foreground/60 line-through' : 'text-foreground/90 font-medium'
              )}
            >
              {sig.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
