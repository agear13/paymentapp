'use client';

import * as React from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import {
  deriveParticipantOperationalStatus,
  operationalRoleLabel,
  participantSummaryStats,
  payoutReadinessLabel,
  type ParticipantOperationalStatus,
} from '@/lib/projects/participants-for-project';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

function statusVariant(
  status: ParticipantOperationalStatus
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'Payout ready':
      return 'default';
    case 'Onboarding incomplete':
      return 'destructive';
    case 'Pending approval':
    case 'Invited':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function ProjectParticipantsView() {
  const { deal, summary, projectParticipants, allDeals, allParticipants, saveSnapshot } =
    useProjectWorkspace();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [obligationCounts, setObligationCounts] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!deal) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/deal-network-pilot/obligations?dealId=${encodeURIComponent(deal.id)}`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: { participant_id: string | null }[];
        };
        const counts: Record<string, number> = {};
        for (const row of json.data ?? []) {
          if (!row.participant_id) continue;
          counts[row.participant_id] = (counts[row.participant_id] ?? 0) + 1;
        }
        if (!cancelled) setObligationCounts(counts);
      } catch {
        /* pilot obligations optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deal?.id]);

  if (!deal || !summary) return null;

  const stats = participantSummaryStats(projectParticipants);
  const payoutState =
    stats.ready === stats.total && stats.total > 0
      ? 'All participants payout-ready'
      : stats.total === 0
        ? 'Add participants to begin payout coordination'
        : `${stats.ready} of ${stats.total} payout-ready`;

  const handleInvite = async (participant: DemoParticipant) => {
    const next = [...allParticipants, participant];
    const ok = await saveSnapshot(allDeals, next);
    if (!ok) throw new Error('persist failed');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Participant readiness: {stats.ready}/{stats.total || 0} ready · {payoutState}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite participant
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total participants</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ready for payout</CardDescription>
            <CardTitle className="text-2xl">{stats.ready}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing onboarding</CardDescription>
            <CardTitle className="text-2xl">{stats.missingOnboarding}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending agreements</CardDescription>
            <CardTitle className="text-2xl">{stats.pendingAgreements}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {projectParticipants.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              No participants yet
            </CardTitle>
            <CardDescription>
              Add everyone operationally involved in this project — contributors, contractors,
              referrers, and partners.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite participant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Project participants</CardTitle>
            <CardDescription>
              Operational stakeholders for this project — not a global referral directory.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payout readiness</TableHead>
                  <TableHead className="text-right">Obligations</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectParticipants.map((p) => {
                  const opStatus = deriveParticipantOperationalStatus(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email || '—'}</TableCell>
                      <TableCell>{operationalRoleLabel(p)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(opStatus)}>{opStatus}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{payoutReadinessLabel(p)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {obligationCounts[p.id] ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" disabled>
                          Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <InviteProjectParticipantModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        project={deal}
        onSubmit={handleInvite}
      />
    </div>
  );
}
