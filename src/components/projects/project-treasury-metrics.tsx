'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  formatOperationalReadiness,
  operationalReadinessBadgeVariant,
} from '@/lib/projects/funding-sources/obligation-readiness';
import {
  formatProjectTreasuryHealth,
  formatTreasuryAmount,
} from '@/lib/projects/funding-sources/format-funding-source';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

type ProjectTreasuryMetricsProps = {
  treasury: ProjectTreasurySummary;
  compact?: boolean;
};

function TreasuryMetricGrid({ treasury }: { treasury: ProjectTreasurySummary }) {
  const fmt = (n: number) => formatTreasuryAmount(n, treasury.currency);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Expected inflows</dt>
        <dd className="font-medium">{fmt(treasury.totalExpectedInflows)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Confirmed</dt>
        <dd className="font-medium">{fmt(treasury.confirmedFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Pending revenue</dt>
        <dd className="font-medium">{fmt(treasury.pendingFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Forecast only</dt>
        <dd className="font-medium">{fmt(treasury.forecastFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Obligations ready</dt>
        <dd className="font-medium">{fmt(treasury.obligationsReady)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Awaiting funding</dt>
        <dd className="font-medium">{fmt(treasury.obligationsAwaitingFunding)}</dd>
      </div>
    </dl>
  );
}

export function ProjectTreasuryMetrics({ treasury, compact = false }: ProjectTreasuryMetricsProps) {
  if (compact) {
    return <TreasuryMetricGrid treasury={treasury} />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Operational treasury</CardTitle>
            <CardDescription>
              Revenue sources help finance teams understand payout readiness before reconciliation
              completes.
            </CardDescription>
          </div>
          <Badge variant="outline">{formatProjectTreasuryHealth(treasury.projectHealth)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TreasuryMetricGrid treasury={treasury} />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Settlement readiness:</span>
          <Badge variant={operationalReadinessBadgeVariant(treasury.operationalReadiness)}>
            {formatOperationalReadiness(treasury.operationalReadiness)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
