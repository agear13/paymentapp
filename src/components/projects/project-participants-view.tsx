'use client';

import * as React from 'react';
import { Copy, RefreshCw, UserPlus, Users } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import { operationalRoleLabel } from '@/lib/projects/participants-for-project';
import {
  attributionStatusLabel,
  deriveAttributionStatus,
  earningsStructureSummary,
  participantAgreementPath,
} from '@/lib/projects/participant-entitlement';
import {
  deriveInviteState,
  deriveParticipationLabel,
  derivePayoutOnboardingState,
  inviteStateLabel,
  onboardingSelectValue,
  participantSummaryMetrics,
  participationLabelText,
  payoutOnboardingLabel,
} from '@/lib/projects/participant-lifecycle';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

const POLL_MS = 12_000;

export function ProjectParticipantsView() {
  const { deal, summary, projectParticipants, allDeals, allParticipants, saveSnapshot, reload } =
    useProjectWorkspace();
  const { organizationId } = useOrganization();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (!deal) return;
    void reload();
    const onFocus = () => void reload();
    const id = window.setInterval(() => void reload(), POLL_MS);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reload();
    });
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [deal?.id, reload]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  };

  if (!deal || !summary) return null;

  const stats = participantSummaryMetrics(projectParticipants);
  const payoutState =
    stats.readyForPayout === stats.total && stats.total > 0
      ? 'All participants payout-ready'
      : stats.total === 0
        ? 'Add participants to begin payout coordination'
        : `${stats.readyForPayout} of ${stats.total} payout-ready`;

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

  const updateOnboarding = async (
    participantId: string,
    value: PilotParticipantOnboardingStatus | 'BLOCKED'
  ) => {
    try {
      const res = await fetch(`/api/deal-network-pilot/participants/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingStatus: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Update failed');
      }
      await reload();
      toast.success('Payout onboarding updated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const activateAttribution = async (participantId: string) => {
    try {
      const res = await fetch(
        `/api/deal-network-pilot/participants/${participantId}/activate-attribution`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Activation failed');
      }
      await reload();
      toast.success('Attribution activated');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Activation failed');
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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="icon" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite participant
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending agreements</CardDescription>
            <CardTitle className="text-2xl">{stats.pendingAgreements}</CardTitle>
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
            <CardDescription>Ready for payout</CardDescription>
            <CardTitle className="text-2xl">{stats.readyForPayout}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active attribution</CardDescription>
            <CardTitle className="text-2xl">{stats.activeAttribution}</CardTitle>
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
              Invite delivery, agreement, attribution, and payout onboarding are tracked separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invite</TableHead>
                  <TableHead>Participation</TableHead>
                  <TableHead>Attribution</TableHead>
                  <TableHead>Payout onboarding</TableHead>
                  <TableHead>Earnings structure</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectParticipants.map((p) => {
                  const invite = deriveInviteState(p);
                  const participation = deriveParticipationLabel(p);
                  const attribution = deriveAttributionStatus(p);
                  const payoutOb = derivePayoutOnboardingState(p);
                  const needsAttribution =
                    p.approvalStatus === 'Approved' &&
                    attribution === 'inactive' &&
                    p.referralCommerce?.createReferralLink !== false;

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
                        <Badge
                          variant={
                            invite === 'approved'
                              ? 'default'
                              : invite === 'opened'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {inviteStateLabel(invite)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={participation === 'approved' ? 'default' : 'outline'}>
                          {participationLabelText(participation)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={attribution === 'active' ? 'default' : 'secondary'}>
                          {attributionStatusLabel(attribution)}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={onboardingSelectValue(p)}
                          onValueChange={(v) =>
                            void updateOnboarding(
                              p.id,
                              v as PilotParticipantOnboardingStatus | 'BLOCKED'
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NOT_STARTED">Not started</SelectItem>
                            <SelectItem value="INCOMPLETE">Incomplete</SelectItem>
                            <SelectItem value="COMPLETE">Ready</SelectItem>
                            <SelectItem value="BLOCKED">Blocked</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {payoutOnboardingLabel(payoutOb)}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {earningsStructureSummary(p)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void copyAgreementLink(p)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            Agreement
                          </Button>
                          {needsAttribution ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void activateAttribution(p.id)}
                            >
                              Activate attribution
                            </Button>
                          ) : null}
                        </div>
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
