'use client';

import Link from 'next/link';
import { Banknote, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import {
  projectObligationsPath,
  projectParticipantsPath,
} from '@/lib/projects/project-routes';
import { OperationalActivitySection } from '@/components/operations/operational-activity-section';
import { useOperationalGuidance } from '@/hooks/use-operational-guidance';

export function ProjectPayoutsView() {
  const { projectId, summary, deal, projectParticipants } = useProjectWorkspace();
  useOperationalGuidance({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    enabled: Boolean(deal),
  });
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Payout coordination for this project: obligations first, then disbursement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCheck className="h-5 w-5" />
              Obligations
            </CardTitle>
            <CardDescription>Review who is owed what before paying out.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline">{summary.payoutLabel}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={projectObligationsPath(projectId)}>View project obligations</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="h-5 w-5" />
              Participant readiness
            </CardTitle>
            <CardDescription>
              {summary.participantsReady}/{summary.participantCount} participants payout-ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={projectParticipantsPath(projectId)}>Manage participants</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <OperationalActivitySection projectId={projectId} defaultOpen={false} />
    </div>
  );
}
