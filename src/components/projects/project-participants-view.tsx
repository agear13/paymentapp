'use client';

import * as React from 'react';
import { Copy, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
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
import { useOrganization } from '@/hooks/use-organization';
import { operationalRoleLabel, participantSummaryStats } from '@/lib/projects/participants-for-project';
import {
  attributionStatusLabel,
  deriveAttributionStatus,
  deriveParticipationState,
  derivePayoutStatus,
  earningsStructureSummary,
  participantAgreementPath,
  participationStateLabel,
  payoutStatusLabel,
} from '@/lib/projects/participant-entitlement';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export function ProjectParticipantsView() {
  const { deal, summary, projectParticipants, allDeals, allParticipants, saveSnapshot } =
    useProjectWorkspace();
  const { organizationId } = useOrganization();
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
        /* optional */
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

  const handleInvite = async (participant: DemoParticipant): Promise<DemoParticipant> => {
    const next = [...allParticipants, participant];
    const ok = await saveSnapshot(allDeals, next);
    if (!ok) throw new Error('persist failed');
    return participant;
  };

  const copyAgreementLink = async (p: DemoParticipant) => {
    const path = p.agreementUrl ?? participantAgreementPath(p.inviteToken);
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Agreement link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {stats.total} stakeholder{stats.total === 1 ? '' : 's'} · {payoutState}
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
              Invite stakeholders, define participation and payout allocation, then send agreement
              links. Customer payment links activate only after approval.
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
              Participation, attribution, and payout readiness are tracked separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Participation</TableHead>
                  <TableHead>Attribution</TableHead>
                  <TableHead>Payout readiness</TableHead>
                  <TableHead>Earnings structure</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectParticipants.map((p) => {
                  const participation = deriveParticipationState(p);
                  const attribution = deriveAttributionStatus(p);
                  const payout = derivePayoutStatus(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.email?.trim() || 'No email'}
                        </div>
                      </TableCell>
                      <TableCell>{operationalRoleLabel(p)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{participationStateLabel(participation)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={attribution === 'active' ? 'default' : 'secondary'}>
                          {attributionStatusLabel(attribution)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{payoutStatusLabel(payout)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {earningsStructureSummary(p)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyAgreementLink(p)}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Agreement
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
        organizationId={organizationId}
        onSubmit={handleInvite}
      />
    </div>
  );
}
