'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type {
  AgreementComparativeRank,
  AgreementHealthSnapshot,
} from '@/lib/agreements/health/agreement-health.types';
import {
  AGREEMENT_COMPARATIVE_RANK_LABELS,
  COMPARATIVE_RANK_ORDER,
  rankAgreementsByComparativeMetric,
} from '@/lib/agreements/health/agreement-health-portfolio';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { projectOverviewPath } from '@/lib/projects/project-routes';

type AgreementComparativeIntelligenceProps = {
  snapshots: AgreementHealthSnapshot[];
  loading?: boolean;
};

export function AgreementComparativeIntelligence({
  snapshots,
  loading,
}: AgreementComparativeIntelligenceProps) {
  const [activeRank, setActiveRank] = React.useState<AgreementComparativeRank>('highest_risk');
  const ranked = React.useMemo(
    () => rankAgreementsByComparativeMetric(snapshots, activeRank, 5),
    [activeRank, snapshots]
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Ranking agreements…
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) return null;

  return (
    <Card className="surface-agreement-card">
      <CardHeader>
        <CardTitle className="text-lg">Comparative intelligence</CardTitle>
        <CardDescription>
          Rank agreements by risk, value, settlement proximity, blockers, and recent health movement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {COMPARATIVE_RANK_ORDER.map((rank) => (
            <button
              key={rank}
              type="button"
              onClick={() => setActiveRank(rank)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                activeRank === rank
                  ? 'border-[rgba(124,92,255,0.35)] bg-[rgba(124,92,255,0.08)] text-foreground'
                  : 'border-border/70 text-muted-foreground hover:text-foreground'
              )}
            >
              {AGREEMENT_COMPARATIVE_RANK_LABELS[rank]}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No agreements match this ranking yet. Health trends appear after coordination changes.
          </p>
        ) : (
          <ol className="space-y-2">
            {ranked.map((item, index) => (
              <li key={item.projectId}>
                <Link
                  href={`${projectOverviewPath(item.projectId)}#briefing-health`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-white/70 px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.agreementName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {rankDetail(item, activeRank)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{item.score}</p>
                    <p className="text-[10px] text-muted-foreground">{item.categoryLabel}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function rankDetail(snapshot: AgreementHealthSnapshot, rank: AgreementComparativeRank): string {
  switch (rank) {
    case 'highest_risk':
      return `${snapshot.blockerCount} blocker(s) · ${snapshot.reducesScore[0] ?? 'Review health factors'}`;
    case 'highest_value':
      return snapshot.agreementValue > 0 ? 'Highest agreement value' : 'Value not yet captured';
    case 'closest_to_settlement':
      return `${snapshot.releaseReadyCount} participant(s) release-ready`;
    case 'most_blocked':
      return `${snapshot.blockerCount} blocking issue(s)`;
    case 'recently_improved':
      return snapshot.trend.label;
    case 'recently_deteriorated':
      return snapshot.trend.label;
    default:
      return snapshot.categoryReason;
  }
}
