'use client';

import * as React from 'react';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { useOrganization } from '@/hooks/use-organization';
import { participantSummaryMetrics } from '@/lib/projects/participant-lifecycle';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { PilotParticipantOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import { useProjectWorkspaceSmartPolling } from '@/hooks/use-project-workspace-refresh';
import { ProjectSectionErrorBoundary } from '@/components/projects/project-section-error-boundary';
import { ProjectParticipantTableRow } from '@/components/projects/project-participant-table-row';
import { participantAgreementPath } from '@/lib/projects/participant-entitlement';

export function ProjectParticipantsView() {
  const {
    deal,
    summary,
    projectParticipants,
    allDeals,
    allParticipants,
    saveSnapshot,
    isRefreshing,
    loading,
    sectionErrors,
    refreshSilent,
    invalidate,
    clearSectionError,
  } = useProjectWorkspace();
  const { organizationId } = useOrganization();
  const [inviteOpen, setInviteOpen] = React.useState(false);

  useProjectWorkspaceSmartPolling({ enabled: Boolean(deal?.id), scope: 'participants' });

  const handleRefresh = React.useCallback(() => {
    invalidate('participants');
    void refreshSilent('participants');
  }, [invalidate, refreshSilent]);

  const copyAgreementLink = React.useCallback(async (p: DemoParticipant) => {
    const path = p.agreementUrl ?? participantAgreementPath(p.inviteToken);
    const url =
      typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Agreement link copied');
    } catch {
      toast.error('Could not copy');
    }
  }, []);

  const updateOnboarding = React.useCallback(
    async (participantId: string, value: PilotParticipantOnboardingStatus | 'BLOCKED') => {
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
        invalidate('participants');
        await refreshSilent('participants');
        toast.success('Payout onboarding updated');
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
      }
    },
    [invalidate, refreshSilent]
  );

  const handleInvite = React.useCallback(
    async (participant: DemoParticipant): Promise<DemoParticipant> => {
      const next = [...allParticipants, participant];
      const ok = await saveSnapshot(allDeals, next);
      if (!ok) throw new Error('persist failed');
      return participant;
    },
    [allDeals, allParticipants, saveSnapshot]
  );

  if (loading && !deal) {
    return null;
  }

  if (!deal || !summary) return null;

  const stats = participantSummaryMetrics(projectParticipants);
  const payoutState =
    stats.readyForPayout === stats.total && stats.total > 0
      ? 'All participants payout-ready'
      : stats.total === 0
        ? 'Add participants to begin payout coordination'
        : `${stats.readyForPayout} of ${stats.total} payout-ready`;

  const sectionError = sectionErrors.participants;

  return (
    <ProjectSectionErrorBoundary
      sectionTitle="Participants"
      onRetry={() => {
        clearSectionError('participants');
        handleRefresh();
      }}
      fallbackMessage={sectionError}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{summary.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {stats.total} stakeholder{stats.total === 1 ? '' : 's'} · {payoutState}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite participant
            </Button>
          </div>
        </div>

        {sectionError ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-4 text-sm text-muted-foreground">
              {sectionError}. Use refresh to retry.
            </CardContent>
          </Card>
        ) : null}

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
                  {projectParticipants.map((p) => (
                    <ProjectParticipantTableRow
                      key={p.id}
                      participant={p}
                      onCopyAgreement={copyAgreementLink}
                      onUpdateOnboarding={updateOnboarding}
                    />
                  ))}
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
    </ProjectSectionErrorBoundary>
  );
}
