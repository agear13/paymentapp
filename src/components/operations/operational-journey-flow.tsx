'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationalKPIs } from '@/lib/operations/reducer/types';
import type { ReleaseConfidenceSnapshot } from '@/lib/operations/explainability/types';
import type { WorkspaceOperationalContext } from '@/lib/operations/types/operational-context';

type OperationalJourneyFlowProps = {
  kpis: OperationalKPIs | null | undefined;
  releaseConfidence: ReleaseConfidenceSnapshot | null;
  workspace: WorkspaceOperationalContext | null;
  loading?: boolean;
};

type JourneyStage = {
  id: string;
  label: string;
  sublabel: string;
};

const STAGES: JourneyStage[] = [
  { id: 'revenue_in',     label: 'Revenue in',      sublabel: 'Collected' },
  { id: 'allocated',      label: 'Allocated',        sublabel: 'Funding linked' },
  { id: 'approved',       label: 'Approved',         sublabel: 'Participants' },
  { id: 'obligations',    label: 'Obligations',      sublabel: 'Obligations set' },
  { id: 'ready',          label: 'Ready',            sublabel: 'Settlement ready' },
  { id: 'released',       label: 'Released',         sublabel: 'Payouts sent' },
];

function deriveCurrentStageIndex(
  kpis: OperationalKPIs | null | undefined,
  releaseConfidence: ReleaseConfidenceSnapshot | null,
  workspace: WorkspaceOperationalContext | null
): number {
  const collected = (releaseConfidence?.collectedRevenue ?? 0) > 0;
  const allocated = (kpis?.fundedObligationCount ?? 0) > 0;
  const approved = (kpis?.approvedAgreementCount ?? 0) > 0;
  const hasObligations = (kpis?.obligationCount ?? 0) > 0;
  const releaseReady = (workspace?.releaseEligibleCount ?? 0) > 0;
  const released = (workspace?.releaseBatchCount ?? 0) > 0;

  if (released) return 5;
  if (releaseReady) return 4;
  if (hasObligations) return 3;
  if (approved) return 2;
  if (allocated) return 1;
  if (collected) return 0;
  return -1; // not started
}

/**
 * Revenue journey pipeline — where does money currently sit in the operational flow?
 * Replaces "agreement lifecycle" mental model with revenue-centric progression.
 */
export function OperationalJourneyFlow({
  kpis,
  releaseConfidence,
  workspace,
  loading,
}: OperationalJourneyFlowProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-white/60 px-4 py-3.5 animate-pulse">
        <div className="flex items-center gap-1.5">
          {STAGES.map((s) => (
            <div key={s.id} className="flex-1 h-1.5 rounded-full bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const currentIndex = deriveCurrentStageIndex(kpis, releaseConfidence, workspace);

  return (
    <div className="rounded-xl border border-border/60 bg-white/60 px-4 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80">
        Revenue journey
      </p>

      {/* Stage pills + connectors */}
      <div className="flex items-center gap-0">
        {STAGES.map((stage, i) => {
          const done = i <= currentIndex;
          const active = i === currentIndex;
          const isLast = i === STAGES.length - 1;

          return (
            <div key={stage.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                {/* Dot */}
                <div
                  className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all',
                    done && !active
                      ? 'bg-[rgb(29,111,66)] border-2 border-[rgb(29,111,66)]'
                      : active
                        ? 'bg-white border-2 border-[rgb(29,111,66)] ring-2 ring-[rgba(29,111,66,0.2)]'
                        : 'bg-muted/40 border-2 border-border/50'
                  )}
                >
                  {done && !active ? (
                    <Check className="h-2.5 w-2.5 text-white" aria-hidden />
                  ) : active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[rgb(29,111,66)]" />
                  ) : null}
                </div>
                {/* Label */}
                <p
                  className={cn(
                    'text-[10px] text-center leading-tight truncate w-full px-0.5',
                    active
                      ? 'font-semibold text-foreground'
                      : done
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                  )}
                >
                  {stage.label}
                </p>
              </div>
              {/* Connector line */}
              {!isLast ? (
                <div
                  className={cn(
                    'flex-shrink-0 h-0.5 w-3 mx-0.5 rounded-full mb-4',
                    i < currentIndex ? 'bg-[rgb(29,111,66)]' : 'bg-border/50'
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Current stage callout */}
      {currentIndex >= 0 ? (
        <p className="text-xs text-muted-foreground">
          Currently at{' '}
          <span className="font-medium text-foreground">{STAGES[currentIndex]?.label}</span>
          {currentIndex < STAGES.length - 1 ? (
            <> — next: {STAGES[currentIndex + 1]?.label}</>
          ) : (
            ' — complete'
          )}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No revenue in flow yet — create an agreement to start.
        </p>
      )}
    </div>
  );
}
