'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectWorkspace } from '@/components/projects/project-workspace-provider';
import { InviteProjectParticipantModal } from '@/components/projects/invite-project-participant-modal';
import { ParticipantCompensationDialog } from '@/components/projects/participant-compensation-dialog';
import { ParticipantAgreementShareDialog } from '@/components/projects/participant-agreement-share-dialog';
import {
  ApprovalCentreHeader,
  deriveApprovalStats,
} from '@/components/projects/approval-centre-header';
import { ApprovalCentreParticipantCard } from '@/components/projects/approval-centre-participant-card';
import { useOrganization } from '@/hooks/use-organization';
import { useOrganizationCurrency } from '@/hooks/use-organization-currency';
import { useEntitlements } from '@/hooks/use-entitlements';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ParticipantCompensationProfile } from '@/lib/participants/participant-compensation-types';
import { applyCompensationProfileToParticipant } from '@/lib/participants/participant-compensation';
import { persistParticipantAgreementShare } from '@/lib/projects/participant-agreement-share';
import { participantWorkspacePathFromParticipant } from '@/lib/projects/participant-entitlement';
import {
  applyOperationalSyncRefresh,
  parseOperationalSync,
  toOperationalSyncHandlers,
} from '@/lib/operations/orchestration/operational-sync-client';
import { notifyWorkspaceActivationRefresh } from '@/hooks/use-workspace-activation';
import { appendOperationalAuditEntry } from '@/hooks/use-operational-audit-store';
import { useOperationalCoordinationState } from '@/hooks/use-operational-coordination-state';

/**
 * People mutations use existing /api/deal-network-pilot/participants routes
 * (not persistWorkspaceFullSnapshot). Nested onboard/review dashboard URLs
 * remain a Phase 4B route-adapter item.
 */
export function CommercialWorkspacePeoplePanel() {
  const {
    deal,
    projectId,
    projectParticipants,
    patchParticipants,
    refresh,
    invalidate,
    refreshSilent,
  } = useProjectWorkspace();
  const { organizationId } = useOrganization();
  const { currency: workspaceCurrency } = useOrganizationCurrency();
  const { isAllowed } = useEntitlements();
  const { reloadCoordinationSnapshot } = useOperationalCoordinationState({
    scope: 'project',
    project: deal ?? undefined,
    participants: projectParticipants,
    enabled: Boolean(deal),
    traceSurface: 'commercial-workspace-people',
  });
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [earningsParticipant, setEarningsParticipant] = React.useState<DemoParticipant | null>(
    null
  );
  const [shareParticipant, setShareParticipant] = React.useState<DemoParticipant | null>(null);

  const syncHandlers = React.useMemo(
    () =>
      toOperationalSyncHandlers({
        invalidate,
        refreshSilent: (scope) => refresh({ scope: scope ?? 'all', silent: true, force: true }),
        reloadCoordinationSnapshot,
        notifyActivation: notifyWorkspaceActivationRefresh,
        onAudit: appendOperationalAuditEntry,
      }),
    [invalidate, refresh, reloadCoordinationSnapshot]
  );

  const handleInvite = React.useCallback(
    async (participant: DemoParticipant): Promise<DemoParticipant> => {
      patchParticipants((list) => [...list, participant]);
      const res = await fetch('/api/deal-network-pilot/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participant }),
      });
      if (!res.ok) {
        patchParticipants((list) => list.filter((p) => p.id !== participant.id));
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Could not add participant');
      }
      const json = (await res.json()) as { participant?: DemoParticipant };
      if (json.participant) {
        patchParticipants((list) =>
          list.map((p) => (p.id === participant.id ? json.participant! : p))
        );
      }
      void refreshSilent('participants');
      return json.participant ?? participant;
    },
    [patchParticipants, refreshSilent]
  );

  const saveCompensation = React.useCallback(
    async (participantId: string, profile: ParticipantCompensationProfile) => {
      const prev = projectParticipants.find((p) => p.id === participantId);
      if (!prev) return;
      const optimistic = applyCompensationProfileToParticipant(prev, profile);
      patchParticipants((list) => list.map((p) => (p.id === participantId ? optimistic : p)));
      const res = await fetch(`/api/deal-network-pilot/participants/${participantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compensationProfile: profile }),
      });
      if (!res.ok) {
        patchParticipants((list) => list.map((p) => (p.id === participantId ? prev : p)));
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Update failed');
      }
      const json = (await res.json()) as { participant?: DemoParticipant };
      if (json.participant) {
        patchParticipants((list) =>
          list.map((p) => (p.id === participantId ? json.participant! : p))
        );
      }
      await applyOperationalSyncRefresh(syncHandlers, parseOperationalSync(json), {
        mutation: 'participant_earnings_save',
        projectId,
        participantId,
        surface: 'commercial-workspace-people',
      });
    },
    [patchParticipants, projectId, projectParticipants, syncHandlers]
  );

  const openAgreementShare = React.useCallback(
    async (p: DemoParticipant, options?: { showDialog?: boolean }) => {
      if (!isAllowed('approval_workflows')) {
        toast.error('Approval workflows are not available on this plan.');
        return;
      }
      const path = participantWorkspacePathFromParticipant(p);
      const now = new Date().toISOString();
      const optimistic: DemoParticipant = {
        ...p,
        agreementUrl: p.agreementUrl ?? path,
        agreementSharedAt: now,
        inviteSentAt: now,
        agreementLifecycle: 'SHARED',
        participantLifecycle: 'INVITE_SENT',
      };
      patchParticipants((list) => list.map((x) => (x.id === p.id ? optimistic : x)));
      const persisted = await persistParticipantAgreementShare(p);
      patchParticipants((list) => list.map((x) => (x.id === p.id ? persisted : x)));
      if (options?.showDialog !== false) setShareParticipant(persisted);
    },
    [isAllowed, patchParticipants]
  );

  if (!deal) return null;

  const stats = deriveApprovalStats(projectParticipants);

  return (
    <div className="space-y-6" data-testid="commercial-workspace-people">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold">People</h2>
          <p className="mt-1 max-w-xl text-[13px] text-ink-soft">
            Participants on this arrangement. Adding people uses the existing operational graph —
            obligations refresh from compensation, not a second people store.
          </p>
        </div>
        <Button type="button" onClick={() => setInviteOpen(true)} data-testid="workspace-add-participant">
          <UserPlus className="mr-2 h-4 w-4" />
          Add participant
        </Button>
      </div>

      {projectParticipants.length > 0 ? (
        <ApprovalCentreHeader
          participants={projectParticipants}
          agreementName={deal.dealName}
          projectId={projectId}
        />
      ) : null}

      {projectParticipants.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <p className="text-[14px] text-ink-soft">
            No participants yet. Add a counterparty to start coordination and derived obligations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projectParticipants.map((participant) => (
            <ApprovalCentreParticipantCard
              key={participant.id}
              participant={participant}
              onShareAgreement={openAgreementShare}
              onConfigureEarnings={setEarningsParticipant}
              projectId={projectId}
              organizationId={organizationId}
              workspaceCurrency={workspaceCurrency}
            />
          ))}
        </div>
      )}

      <p className="text-[12px] text-ink-soft">
        {stats.total} participant{stats.total === 1 ? '' : 's'}
        {stats.pending > 0 ? ` · ${stats.pending} pending acceptance` : ''}
      </p>

      {deal ? (
        <InviteProjectParticipantModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          project={deal}
          organizationId={organizationId}
          onSubmit={handleInvite}
        />
      ) : null}

      <ParticipantCompensationDialog
        participant={earningsParticipant}
        projectId={projectId}
        organizationId={organizationId}
        workspaceCurrency={workspaceCurrency}
        open={Boolean(earningsParticipant)}
        onOpenChange={(open) => {
          if (!open) setEarningsParticipant(null);
        }}
        onSave={async (profile) => {
          if (!earningsParticipant) return;
          await saveCompensation(earningsParticipant.id, profile);
        }}
      />

      <ParticipantAgreementShareDialog
        participant={shareParticipant}
        open={Boolean(shareParticipant)}
        onOpenChange={(open) => {
          if (!open) setShareParticipant(null);
        }}
      />
    </div>
  );
}
