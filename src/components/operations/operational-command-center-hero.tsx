'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { OperationalGuidanceBundle } from '@/lib/operations/explainability';
import type { AttentionItem } from '@/lib/operations/severity';
import { countAttentionMetrics } from '@/lib/operations/severity';
import {
  labelSafeToRelease,
  OPERATOR_LABELS,
  WORKSPACE_PHASE_OPERATOR,
} from '@/lib/operations/design-language';
import { OperationalStatePill } from '@/components/operations/operational-state-pill';
import { OperationalTrustStrip } from '@/components/operations/operational-trust-strip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type OperationalCommandCenterHeroProps = {
  guidance: OperationalGuidanceBundle;
  attentionItems: AttentionItem[];
  workspacePhase: string;
  loading?: boolean;
};

export function OperationalCommandCenterHero({
  guidance,
  attentionItems,
  workspacePhase,
  loading,
}: OperationalCommandCenterHeroProps) {
  const metrics = countAttentionMetrics(attentionItems);
  const action = guidance.actions[0];
  const conf = guidance.releaseConfidence.level;
  const phaseLabel = WORKSPACE_PHASE_OPERATOR[workspacePhase] ?? guidance.explanation.phaseLabel;

  if (loading) {
    return (
      <header className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-full max-w-lg bg-muted rounded" />
      </header>
    );
  }

  return (
    <header className="space-y-6 pb-6 border-b border-border/60">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Operational coordination status
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
          Monitor funding, participant payout setup, payout obligations, and payout safety
          across your workspace.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OperationalStatePill phase={workspacePhase} scope="workspace" />
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{phaseLabel}</span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
        <Metric label={OPERATOR_LABELS.safeToRelease} value={labelSafeToRelease(conf)} />
        <Metric
          label={OPERATOR_LABELS.needsAttention}
          value={metrics.needsAttention > 0 ? String(metrics.needsAttention) : 'None'}
          highlight={metrics.needsAttention > 0}
        />
        <Metric
          label={OPERATOR_LABELS.fundingPending}
          value={metrics.fundingPending > 0 ? String(metrics.fundingPending) : 'None'}
        />
        <Metric
          label={OPERATOR_LABELS.participantsIncomplete}
          value={
            metrics.participantsIncomplete > 0 ? String(metrics.participantsIncomplete) : 'None'
          }
        />
      </dl>

      {guidance.explanation.blockers[0] ? (
        <p className="text-sm text-foreground/90">{guidance.explanation.blockers[0]}</p>
      ) : null}

      {action ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Next step</p>
            <p className="text-sm font-medium">{action.action}</p>
          </div>
          <Button asChild size="sm" className="w-fit shrink-0">
            <Link href={action.destination}>
              {action.ctaLabel ?? 'Continue'}
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      <OperationalTrustStrip signals={guidance.trustSignals} />
    </header>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-lg font-semibold mt-1 tabular-nums',
          highlight && 'text-amber-800 dark:text-amber-300'
        )}
      >
        {value}
      </dd>
    </div>
  );
}
