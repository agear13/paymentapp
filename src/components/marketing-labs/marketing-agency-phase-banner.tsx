'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MARKETING_AGENCY_PHASE_LABELS,
  resolveMarketingAgencyPhase,
  type MarketingAgencyPhase,
} from '@/lib/marketing-jobs/marketing-agency-phase';
import type { MarketingWorkspaceState } from '@/lib/marketing-jobs/types';

const PHASE_ORDER: MarketingAgencyPhase[] = [
  'intake',
  'strategy_running',
  'strategy_review',
  'creative_running',
  'assets_ready',
  'operations',
  'delivery',
];

function phaseIndex(phase: MarketingAgencyPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

type MarketingAgencyPhaseBannerProps = {
  state: MarketingWorkspaceState;
};

export function MarketingAgencyPhaseBanner({ state }: MarketingAgencyPhaseBannerProps) {
  const phase = resolveMarketingAgencyPhase(state);
  const currentIndex = phaseIndex(phase);
  const isPhase1 = currentIndex <= phaseIndex('strategy_review');
  const isPhase2 = currentIndex >= phaseIndex('creative_running');

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/[0.05] via-background to-primary/[0.03] p-4 shadow-sm animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Agency workflow</p>
          <p className="text-sm font-medium">{MARKETING_AGENCY_PHASE_LABELS[phase]}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'rounded-full px-3 py-1 font-medium',
              isPhase1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            Phase 1 — Strategy
          </span>
          <span className="text-muted-foreground">→</span>
          <span
            className={cn(
              'rounded-full px-3 py-1 font-medium',
              isPhase2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            Phase 2 — Creative Production
          </span>
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        {PHASE_ORDER.map((step, index) => (
          <span
            key={step}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              index <= currentIndex ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      {phase === 'delivery' ? (
        <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[rgb(29,111,66)]">
          <CheckCircle2 className="size-3.5" />
          Campaign delivered — final deliverables ready for client handover.
        </p>
      ) : null}
    </div>
  );
}
