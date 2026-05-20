'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { ProjectFundingSourcesPanel } from '@/components/projects/project-funding-sources-panel';
import { ProjectTreasuryMetrics } from '@/components/projects/project-treasury-metrics';
import {
  projectFundingPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';
import { formatTreasuryAmount } from '@/lib/projects/funding-sources/format-funding-source';
import type { ProjectTreasurySummary } from '@/lib/projects/funding-sources/types';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  const { summary, refresh } = useProjectWorkspace();
  const [treasury, setTreasury] = React.useState<ProjectTreasurySummary | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/treasury-summary`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { data: ProjectTreasurySummary };
        if (!cancelled) setTreasury(json.data);
      } catch {
        if (!cancelled) setTreasury(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, summary?.treasury?.fundingSourceCount]);

  if (!summary) return null;

  const participantsHref = projectParticipantsPath(projectId);
  const fundingHref = projectFundingPath(projectId);
  const payoutsHref = projectPayoutsPath(projectId);

  const participantLabel = formatParticipantPayoutReadiness(
    summary.participantsReady,
    summary.participantCount
  );

  const currency = treasury?.currency ?? 'USD';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{summary.name}</h1>
          {summary.description ? (
            <p className="text-muted-foreground mt-1 max-w-2xl">{summary.description}</p>
          ) : (
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Coordinate participants, funding, obligations, and payouts for this project.
              Operational allocation and settlement execution stay in separate views.
            </p>
          )}
        </div>
        <Button asChild className="w-fit">
          <Link href={participantsHref}>Invite participants</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{summary.operationalStageLabel}</Badge>
        <Badge variant="outline">{summary.settlementStatus}</Badge>
        <Badge variant="outline">{summary.currencyLabel}</Badge>
        {summary.needsAttention ? (
          <Badge variant="outline" className="border-amber-500/35 text-amber-800">
            Needs attention
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants
            </CardDescription>
            <CardTitle className="text-2xl">
              {summary.participantCount === 0
                ? '—'
                : `${summary.participantsReady}/${summary.participantCount}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {summary.participantCount === 0
              ? 'No participants added yet'
              : summary.participantsPending > 0
                ? `${participantLabel} · ${summary.participantsPending} still need payout readiness`
                : participantLabel}
            <div>
              <Button asChild variant="outline" size="sm">
                <Link href={participantsHref}>Manage participants</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Funding sources
            </CardDescription>
            <CardTitle className="text-lg">{summary.fundingLabel}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{summary.fundingSubcopy}</p>
            {treasury && treasury.hasFundingSources ? (
              <p className="text-sm">
                Confirmed:{' '}
                <span className="font-medium">
                  {formatTreasuryAmount(treasury.confirmedFunding, currency)}
                </span>
              </p>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={fundingHref}>Manage funding</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              Payouts
            </CardDescription>
            <CardTitle className="text-lg">{summary.payoutLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={payoutsHref}>View payouts</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {treasury ? <ProjectTreasuryMetrics treasury={treasury} compact /> : null}

      <ProjectFundingSourcesPanel
        projectId={projectId}
        defaultCurrency={currency}
        onTreasuryChange={() => void refresh({ scope: 'all', silent: true, force: true })}
      />
    </div>
  );
}
