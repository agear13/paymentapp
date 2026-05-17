'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  FileCheck,
  Loader2,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { fetchPilotSnapshot } from '@/lib/deal-network-demo/pilot-store';
import { persistPreferredDealIdToSession } from '@/lib/deal-network-demo/active-deal-resolution';
import { summarizeProject } from '@/lib/projects/project-workspace-summary';
import { PAYOUTS_OBLIGATIONS_HREF } from '@/lib/navigation/operator-nav';

type ProjectDetailHubProps = {
  projectId: string;
};

export function ProjectDetailHub({ projectId }: ProjectDetailHubProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [summary, setSummary] = React.useState<ReturnType<typeof summarizeProject> | null>(null);

  React.useEffect(() => {
    persistPreferredDealIdToSession(projectId);
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const snapshot = await fetchPilotSnapshot();
      if (cancelled) return;
      const deal = snapshot?.deals.find((d) => d.id === projectId);
      if (!deal) {
        setNotFound(true);
        setSummary(null);
      } else {
        setNotFound(false);
        setSummary(summarizeProject(deal, snapshot?.participants ?? []));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading project…
      </div>
    );
  }

  if (notFound || !summary) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All projects
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Project not found</CardTitle>
            <CardDescription>This project may have been removed or you may not have access.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard/projects">Back to projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const workspaceHref = '/dashboard/partners/deal-network';
  const obligationsHref = PAYOUTS_OBLIGATIONS_HREF;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit px-0" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            All projects
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
          <Button onClick={() => router.push(workspaceHref)}>
            Open coordination workspace
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
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
          <CardContent className="text-sm text-muted-foreground">
            {summary.participantsPending > 0
              ? `${summary.participantsPending} still need payout readiness`
              : 'All participants payout-ready or none added yet'}
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
              <Link href="/dashboard/payment-links?action=create">Create invoice</Link>
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
              <Link href={obligationsHref}>View obligations</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project operations</CardTitle>
          <CardDescription>
            Contextual actions for this project — invoices, participants, obligations, and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: 'Participants',
              description: 'Invite and manage who participates in this project.',
              href: '/dashboard/participants',
              icon: Users,
            },
            {
              title: 'Invoices & funding',
              description: 'Collect funds via invoices and payment links.',
              href: '/dashboard/payment-links?action=create',
              icon: Wallet,
            },
            {
              title: 'Obligations',
              description: 'Review funding gaps and payout readiness.',
              href: obligationsHref,
              icon: FileCheck,
            },
            {
              title: 'Commissions & payouts',
              description: 'Track earned commissions and payout history.',
              href: '/dashboard/partners/commissions',
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
