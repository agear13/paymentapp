'use client';

import * as React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectParticipantAgreementPanel } from '@/components/projects/project-participant-agreement-panel';
import { ParticipantCommercialWorkspaceView } from '@/components/participant-portal/participant-portal-view';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { CommercialWorkspaceSection } from '@/lib/participant-portal/participant-portal-types';
import {
  deriveParticipantWorkspaceExperience,
  type ParticipantCommercialState,
} from '@/lib/participant-portal/participant-workspace-state';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { ScopedServiceCommissionRow } from '@/lib/projects/participant-compensation-copy';

type InvitePayload = {
  deal: RecentDeal;
  participant: DemoParticipant;
  dealParticipants?: DemoParticipant[];
  scopedServiceRows?: ScopedServiceCommissionRow[];
  workspaceSource?: 'project' | 'pilot';
};

type WorkspaceBootstrap = {
  commercialState: ParticipantCommercialState;
  inviteToken: string;
  workspace: ParticipantCommercialWorkspaceModel | null;
};

type Props = {
  portalToken: string;
  bootstrap: WorkspaceBootstrap;
  previewMode?: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
};

async function fetchInvitePayload(inviteToken: string): Promise<InvitePayload | null> {
  const res = await fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(inviteToken)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as InvitePayload;
}

function WorkspaceShell({
  projectName,
  children,
}: {
  projectName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              P
            </div>
            <span className="font-semibold tracking-tight shrink-0">Provvypay</span>
          </div>
          <p className="text-xs text-muted-foreground truncate hidden sm:block">{projectName}</p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t mt-8 py-6 text-center text-xs text-muted-foreground">
        Your participant workspace · Powered by Provvypay
      </footer>
    </div>
  );
}

function AwaitingAgreementSend({ projectName }: { projectName: string }) {
  return (
    <WorkspaceShell projectName={projectName}>
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Your workspace is ready</CardTitle>
          <CardDescription>
            The organiser is still preparing your commercial agreement. You will review and approve
            it here — no separate link required. Check back soon or contact the organiser if you
            expected to receive terms already.
          </CardDescription>
        </CardHeader>
      </Card>
    </WorkspaceShell>
  );
}

export function ParticipantWorkspaceGate({
  portalToken,
  bootstrap,
  previewMode = false,
  onRefresh,
  isRefreshing = false,
}: Props) {
  const [activeSection, setActiveSection] = React.useState<CommercialWorkspaceSection>('overview');
  const [workspace, setWorkspace] = React.useState(bootstrap.workspace);
  const [commercialState, setCommercialState] = React.useState(bootstrap.commercialState);
  const [invitePayload, setInvitePayload] = React.useState<InvitePayload | null>(null);
  const [inviteLoading, setInviteLoading] = React.useState(false);

  const experience = deriveParticipantWorkspaceExperience(commercialState);

  React.useEffect(() => {
    setWorkspace(bootstrap.workspace);
    setCommercialState(bootstrap.commercialState);
  }, [bootstrap]);

  const participantApproved = workspace?.agreementStatus === 'approved';
  const showAgreementReview =
    !participantApproved && (experience === 'agreement_review' || previewMode);

  React.useEffect(() => {
    if (!showAgreementReview) return;
    let cancelled = false;
    setInviteLoading(true);
    void fetchInvitePayload(bootstrap.inviteToken)
      .then((data) => {
        if (!cancelled) setInvitePayload(data);
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showAgreementReview, bootstrap.inviteToken]);

  const handleApproved = React.useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  if (experience === 'awaiting_send' && !previewMode) {
    return (
      <AwaitingAgreementSend projectName={workspace?.projectName ?? 'Your project'} />
    );
  }

  if (showAgreementReview) {
    if (inviteLoading || !invitePayload) {
      return (
        <WorkspaceShell projectName={workspace?.projectName ?? 'Your project'}>
          <p className="text-sm text-muted-foreground text-center py-12">
            Loading your agreement…
          </p>
        </WorkspaceShell>
      );
    }

    return (
      <WorkspaceShell projectName={invitePayload.deal.dealName}>
        <div className="flex justify-center">
          <ProjectParticipantAgreementPanel
            token={bootstrap.inviteToken}
            deal={invitePayload.deal}
            participant={invitePayload.participant}
            dealParticipants={invitePayload.dealParticipants ?? []}
            initialApproved={invitePayload.participant.approvalStatus === 'Approved'}
            initialReferralIssuance={null}
            initialScopedServiceRows={invitePayload.scopedServiceRows ?? []}
            mode={previewMode ? 'preview' : 'approval'}
            onApproved={handleApproved}
          />
        </div>
      </WorkspaceShell>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  return (
    <ParticipantCommercialWorkspaceView
      workspace={workspace}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onRefresh={() => void onRefresh()}
      isRefreshing={isRefreshing}
    />
  );
}
