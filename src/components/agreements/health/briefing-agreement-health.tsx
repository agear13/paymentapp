'use client';

import Link from 'next/link';
import { AlertTriangle, Check, TrendingDown, TrendingUp } from 'lucide-react';
import type { AgreementHealthSnapshot } from '@/lib/agreements/health/agreement-health.types';
import { BriefingSectionShell } from '@/components/agreements/briefing/briefing-section-shell';
import { BriefingScoreRing } from '@/components/agreements/briefing/briefing-score-ring';
import { IntelligenceBadge } from '@/components/provvypay/intelligence-badge';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { projectOverviewPath } from '@/lib/projects/project-routes';

const categoryTone: Record<AgreementHealthSnapshot['category'], string> = {
  excellent: 'text-[rgb(29,111,66)] bg-[rgba(223,247,232,0.6)] border-[rgba(29,111,66,0.2)]',
  healthy: 'text-[rgb(29,111,66)] bg-[rgba(223,247,232,0.45)] border-[rgba(29,111,66,0.15)]',
  attention_required: 'text-amber-800 bg-amber-50 border-amber-500/25',
  at_risk: 'text-orange-800 bg-orange-50 border-orange-500/25',
  critical: 'text-red-800 bg-red-50 border-red-500/25',
};

type BriefingAgreementHealthProps = {
  health: AgreementHealthSnapshot;
};

export function BriefingAgreementHealth({ health }: BriefingAgreementHealthProps) {
  const positiveFactors = health.factors.filter((f) => f.status === 'positive');
  const warningFactors = health.factors.filter((f) => f.status === 'warning');
  const negativeFactors = health.factors.filter((f) => f.status === 'negative');

  return (
    <BriefingSectionShell
      id="briefing-health"
      title="Agreement Health"
      description="Composite coordination posture — fully explainable from settlement, funding, approval, and participant signals."
      variant="intelligence"
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <BriefingScoreRing
            value={health.score}
            label="Agreement health"
            sublabel={health.categoryLabel}
            variant="intelligence"
          />
          <div className="space-y-3 text-center sm:text-left">
            <IntelligenceBadge />
            <Badge className={cn('text-sm px-3 py-1', categoryTone[health.category])}>
              {health.categoryLabel}
            </Badge>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              {health.categoryReason}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm">
              {health.trend.direction === 'improved' ? (
                <TrendingUp className="h-4 w-4 text-[rgb(29,111,66)]" />
              ) : health.trend.direction === 'declined' ? (
                <TrendingDown className="h-4 w-4 text-amber-600" />
              ) : null}
              <span
                className={cn(
                  health.trend.direction === 'improved' && 'text-[rgb(29,111,66)] font-medium',
                  health.trend.direction === 'declined' && 'text-amber-700 font-medium'
                )}
              >
                {health.trend.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 min-w-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Driven by
            </p>
            <ul className="space-y-2">
              {positiveFactors.slice(0, 4).map((factor) => (
                <li key={factor.id} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-[rgb(29,111,66)] shrink-0 mt-0.5" />
                  <span>{factor.label}</span>
                </li>
              ))}
              {warningFactors.slice(0, 3).map((factor) => (
                <li key={factor.id} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {factor.label} — {factor.detail}
                  </span>
                </li>
              ))}
              {negativeFactors.slice(0, 2).map((factor) => (
                <li key={factor.id} className="flex items-start gap-2 text-sm text-red-800/90">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {factor.label} — {factor.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {health.trend.contributingFactors.length > 0 ? (
            <div className="rounded-lg border border-[rgba(124,92,255,0.12)] bg-white/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Why the score changed
              </p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {health.trend.contributingFactors.map((factor) => (
                  <li key={factor}>{factor}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(29,111,66)] mb-2">
                Improves score
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {health.improvesScore.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 mb-2">
                Reduces score
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {health.reducesScore.length > 0 ? (
                  health.reducesScore.map((item) => <li key={item}>• {item}</li>)
                ) : (
                  <li>• No major score reductions detected.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </BriefingSectionShell>
  );
}

export function AgreementHealthScoreBadge({ health }: { health: AgreementHealthSnapshot }) {
  return (
    <Link
      href={`${projectOverviewPath(health.projectId)}#briefing-health`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-90',
        categoryTone[health.category]
      )}
    >
      <span>{health.score}</span>
      <span className="font-normal opacity-80">{health.categoryLabel}</span>
    </Link>
  );
}
