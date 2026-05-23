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
};

/** Canonical operational funding summary — single source of treasury KPIs. */
function TreasuryMetricGrid({ treasury }: { treasury: ProjectTreasurySummary }) {
  const fmt = (n: number) => formatTreasuryAmount(n, treasury.currency);
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
      <div>
        <dt className="text-muted-foreground">Confirmed funding</dt>
        <dd className="font-medium tabular-nums">{fmt(treasury.confirmedFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Awaiting funding</dt>
        <dd className="font-medium tabular-nums">{fmt(treasury.obligationsAwaitingFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Pending revenue</dt>
        <dd className="font-medium tabular-nums">{fmt(treasury.pendingFunding)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Obligations ready</dt>
        <dd className="font-medium tabular-nums">{fmt(treasury.obligationsReady)}</dd>
      </div>
      <div className="col-span-2 sm:col-span-1">
        <dt className="text-muted-foreground">Settlement readiness</dt>
        <dd className="mt-0.5">
          <Badge variant={operationalReadinessBadgeVariant(treasury.operationalReadiness)}>
            {formatOperationalReadiness(treasury.operationalReadiness)}
          </Badge>
        </dd>
      </div>
    </dl>
  );
}

export function ProjectTreasuryMetrics({ treasury }: ProjectTreasuryMetricsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Operational treasury</CardTitle>
            <CardDescription>
              Authoritative funding summary for payout coordination and settlement readiness.
            </CardDescription>
          </div>
          <Badge variant="outline">{formatProjectTreasuryHealth(treasury.projectHealth)}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <TreasuryMetricGrid treasury={treasury} />
      </CardContent>
    </Card>
  );
}
