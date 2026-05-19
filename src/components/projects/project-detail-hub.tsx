'use client';

import Link from 'next/link';
import { Banknote, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  projectFundingPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';
import { formatParticipantPayoutReadiness } from '@/lib/projects/format-participant-payout-readiness';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  const { summary } = useProjectWorkspace();
  if (!summary) return null;

  const participantsHref = projectParticipantsPath(projectId);
  const fundingHref = projectFundingPath(projectId);
  const payoutsHref = projectPayoutsPath(projectId);

  const participantLabel = formatParticipantPayoutReadiness(
    summary.participantsReady,
    summary.participantCount
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{summary.name}</h1>
          {summary.description ? (
            <p className="text-muted-foreground mt-1 max-w-2xl">{summary.description}</p>
          ) : (
            <p className="text-muted-foreground mt-1">
              Coordinate participants, funding, obligations, and payouts for this project.
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
          <Badge variant="outline" className="border-amber-500/50 text-amber-800">
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
              Funding
            </CardDescription>
            <CardTitle className="text-lg">{summary.fundingLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={fundingHref}>Add invoice</Link>
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
    </div>
  );
}
