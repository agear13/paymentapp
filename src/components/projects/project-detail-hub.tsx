'use client';

import Link from 'next/link';
import { Banknote, FileCheck, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  projectFundingPath,
  projectObligationsPath,
  projectParticipantsPath,
  projectPayoutsPath,
} from '@/lib/projects/project-routes';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  const { summary } = useProjectWorkspace();
  if (!summary) return null;

  const participantsHref = projectParticipantsPath(projectId);
  const fundingHref = projectFundingPath(projectId);
  const obligationsHref = projectObligationsPath(projectId);
  const payoutsHref = projectPayoutsPath(projectId);

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
        <Badge variant="secondary">{summary.operationalStage}</Badge>
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
              {summary.participantsReady}/{summary.participantCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {summary.participantsPending > 0
              ? `${summary.participantsPending} still need payout readiness`
              : 'All participants payout-ready or none added yet'}
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
              <Link href={fundingHref}>Funding workspace</Link>
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
              <Link href={payoutsHref}>Payout coordination</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project operations</CardTitle>
          <CardDescription>
            Contextual actions for this project — participants, funding, obligations, and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: 'Participants',
              description: 'Invite and manage who participates in this project.',
              href: participantsHref,
              icon: Users,
            },
            {
              title: 'Funding',
              description: 'Collect funds via invoices and payment links.',
              href: fundingHref,
              icon: Wallet,
            },
            {
              title: 'Obligations',
              description: 'Review funding gaps and payout readiness.',
              href: obligationsHref,
              icon: FileCheck,
            },
            {
              title: 'Payouts',
              description: 'Coordinate disbursement after obligations are clear.',
              href: payoutsHref,
              icon: Banknote,
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50"
            >
              <item.icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
