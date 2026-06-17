'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OperationalAction } from '@/lib/operations/explainability/types';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';

type BusinessInsightPanelProps = {
  actions: OperationalAction[];
  snapshots?: AgreementHealthSnapshot[];
};

type OutcomeBullet = {
  text: string;
};

function deriveOutcomeBullets(
  actions: OperationalAction[],
  delta: { agreementName: string; currentScore: number; projectedScore: number } | null
): OutcomeBullet[] {
  const bullets: OutcomeBullet[] = [];
  const actionText = actions
    .slice(0, 3)
    .map((a) => a.action.toLowerCase())
    .join(' ');

  if (/payout|release|settlement/i.test(actionText)) {
    bullets.push({ text: 'unlock settlement funds for distribution' });
  }
  if (/participant|approval|invite/i.test(actionText)) {
    bullets.push({ text: 'allow participant payouts to proceed' });
  }
  if (/stripe|payment provider|connect/i.test(actionText)) {
    bullets.push({ text: 'enable revenue collection to begin' });
  }
  if (/obligation|funding|allocat/i.test(actionText)) {
    bullets.push({ text: 'confirm obligations and unlock release' });
  }

  if (bullets.length === 0 && delta) {
    bullets.push({ text: `increase ${delta.agreementName} readiness to ${delta.projectedScore}%` });
  }

  if (bullets.length === 0) {
    bullets.push({ text: 'advance agreements closer to settlement' });
  }

  return bullets.slice(0, 3);
}

function deriveConfidence(actions: OperationalAction[]): 'High' | 'Medium' | 'Low' {
  const urgencies = actions.slice(0, 3).map((a) => a.urgency);
  if (urgencies.some((u) => u === 'critical' || u === 'high')) return 'High';
  if (urgencies.some((u) => u === 'medium')) return 'Medium';
  return 'Low';
}

const URGENCY_MINUTES: Record<OperationalAction['urgency'], number> = {
  critical: 1,
  high: 2,
  medium: 5,
  low: 10,
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Derive an expected outcome delta for the insight panel.
 * Uses the lowest-scored snapshot as the primary agreement to improve.
 */
function deriveOutcomeDelta(
  snapshots: AgreementHealthSnapshot[] | undefined,
  actions: OperationalAction[]
): { agreementName: string; currentScore: number; projectedScore: number } | null {
  if (!snapshots || snapshots.length === 0) return null;

  const primary = [...snapshots].sort((a, b) => a.score - b.score)[0];
  if (!primary) return null;

  // Rough projection: each high/critical action improves score by ~10-15 points
  const impactfulActions = actions.filter(
    (a) => a.urgency === 'critical' || a.urgency === 'high'
  ).slice(0, 3);

  const improvement = impactfulActions.reduce((sum) => sum + 12, 0);
  const projected = Math.min(95, primary.score + improvement);

  if (projected <= primary.score + 5) return null;

  return {
    agreementName: primary.agreementName,
    currentScore: primary.score,
    projectedScore: projected,
  };
}

/**
 * Conversational AI operations manager — appears once, at the bottom of the dashboard.
 * Decision → Action → Explanation. Never the other way around.
 */
export function BusinessInsightPanel({ actions, snapshots }: BusinessInsightPanelProps) {
  const primary = actions[0];
  if (!primary) return null;

  const steps = actions.slice(0, 3);
  const totalMinutes = steps.reduce((sum, a) => sum + (URGENCY_MINUTES[a.urgency] ?? 2), 0);
  const delta = deriveOutcomeDelta(snapshots, actions);
  const outcomes = deriveOutcomeBullets(actions, delta);
  const confidence = deriveConfidence(actions);

  const focusLine = delta?.agreementName
    ? `Complete ${delta.agreementName} today.`
    : `Complete today's ${steps.length} action${steps.length === 1 ? '' : 's'}.`;

  const confidenceColor = {
    High: 'text-[rgb(29,111,66)]',
    Medium: 'text-amber-700',
    Low: 'text-muted-foreground',
  }[confidence];

  return (
    <section aria-label="Business assistant" className="space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[rgb(124,92,255)]">
        Business Assistant
      </p>

      <div className="rounded-xl border border-[rgba(124,92,255,0.2)] bg-gradient-to-br from-[rgba(124,92,255,0.06)] via-white to-[rgba(124,92,255,0.02)] p-5 space-y-4">

        {/* Recommendation headline */}
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current recommendation
          </p>
          <p className="font-semibold text-foreground">{focusLine}</p>
        </div>

        {/* Outcomes */}
        {outcomes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Doing so will:</p>
            <ul className="space-y-1">
              {outcomes.map((o) => (
                <li key={o.text} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[rgb(29,111,66)] shrink-0" aria-hidden />
                  <span className="text-foreground/80 leading-snug">{o.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Outcome delta */}
        {delta ? (
          <div className="rounded-lg border border-[rgba(29,111,66,0.2)] bg-[rgba(29,111,66,0.04)] px-3.5 py-2.5 flex items-center gap-3">
            <TrendingUp className="h-4 w-4 text-[rgb(29,111,66)] shrink-0" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Settlement readiness
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">
                <span className="text-muted-foreground">{delta.currentScore}%</span>
                {' → '}
                <span className="text-[rgb(29,111,66)]">{delta.projectedScore}%</span>
              </p>
            </div>
          </div>
        ) : null}

        {/* Footer: time + confidence + CTA */}
        <div className="flex items-center justify-between gap-3 pt-0.5 border-t border-[rgba(124,92,255,0.1)]">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">
              Estimated effort —{' '}
              <span className="font-medium text-foreground">
                {totalMinutes} minute{totalMinutes === 1 ? '' : 's'}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Confidence —{' '}
              <span className={cn('font-medium', confidenceColor)}>{confidence}</span>
            </p>
          </div>
          {primary.destination ? (
            <Button
              asChild
              size="sm"
              className="h-8 text-xs bg-[rgb(124,92,255)] hover:bg-[rgb(108,78,235)] text-white border-0 shrink-0"
            >
              <Link href={primary.destination}>
                Begin
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
