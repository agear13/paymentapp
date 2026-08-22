'use client';

import * as React from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectParticipantAgreementPanel } from '@/components/projects/project-participant-agreement-panel';
import { ParticipantCommercialWorkspaceView } from '@/components/participant-portal/participant-portal-view';
import { ParticipantWorkspacePayoutPanel } from '@/components/participant-portal/participant-workspace-payout-panel';
import { ParticipantWorkspaceOnboardingProgress } from '@/components/participant-portal/participant-workspace-onboarding-progress';
import { ParticipantLogoutButton } from '@/components/participant-portal/participant-logout-button';
import type { ParticipantCommercialWorkspaceModel } from '@/lib/participant-portal/participant-portal-data';
import type { CommercialWorkspaceSection } from '@/lib/participant-portal/participant-portal-types';
import type { ParticipantWorkspaceOnboarding } from '@/lib/participant-portal/participant-workspace-onboarding';
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
  onboarding: ParticipantWorkspaceOnboarding;
  inviteToken: string;
  workspace: ParticipantCommercialWorkspaceModel | null;
  paymentSetupToken: string | null;
};

type Props = {
  portalToken: string;
  bootstrap: WorkspaceBootstrap;
  previewMode?: boolean;
  signedInEmail?: string | null;
  onSignOut?: () => void;
  onRefresh: () => Promise<void>;
  isRefreshing?: boolean;
};

async function fetchInvitePayload(inviteToken: string): Promise<InvitePayload | null> {
  const res = await fetch(`/api/deal-network-pilot/invites/${encodeURIComponent(inviteToken)}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) return null;
  return (await res.json()) as InvitePayload;
}

function WorkspaceShell({
  projectName,
  signedInEmail,
  portalToken,
  onSignOut,
  children,
}: {
  projectName: string;
  signedInEmail?: string | null;
  portalToken?: string;
  onSignOut?: () => void;
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
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{projectName}</p>
            {signedInEmail ? (
              <p className="text-xs text-muted-foreground truncate hidden md:block">{signedInEmail}</p>
            ) : null}
            {onSignOut || portalToken ? (
              <ParticipantLogoutButton token={portalToken} onSignedOut={onSignOut} />
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>
      <footer className="border-t mt-8 py-6 text-center text-xs text-muted-foreground space-y-1">
        <p>Your participant workspace · Powered by Provvypay</p>
        <p data-testid="participant-bookmark-hint">
          You can bookmark this page to return to your workspace anytime.
        </p>
      </footer>
    </div>
  );
}

function AwaitingAgreementSend({
  projectName,
  signedInEmail,
  portalToken,
  onSignOut,
}: {
  projectName: string;
  signedInEmail?: string | null;
  portalToken?: string;
  onSignOut?: () => void;
}) {
  return (
    <WorkspaceShell projectName={projectName} signedInEmail={signedInEmail} portalToken={portalToken} onSignOut={onSignOut}>
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

function PayoutSubmittedWaiting({
  projectName,
  participantName,
  signedInEmail,
  portalToken,
  onSignOut,
}: {
  projectName: string;
  participantName: string;
  signedInEmail?: string | null;
  portalToken?: string;
  onSignOut?: () => void;
}) {
  return (
    <WorkspaceShell projectName={projectName} signedInEmail={signedInEmail} portalToken={portalToken} onSignOut={onSignOut}>
      <ParticipantWorkspaceOnboardingProgress
        currentStep="payout_submitted"
        nextRequiredAction={null}
      >
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Payout details received</CardTitle>
            <CardDescription>
              Thanks, {participantName}. Your organiser is verifying your payout and tax details.
              You will stay in this workspace — no separate links required.
            </CardDescription>
          </CardHeader>
        </Card>
      </ParticipantWorkspaceOnboardingProgress>
    </WorkspaceShell>
  );
}

export function ParticipantWorkspaceGate({
  portalToken,
  bootstrap,
  previewMode = false,
  signedInEmail,
  onSignOut,
  onRefresh,
  isRefreshing = false,
}: Props) {
  const [activeSection, setActiveSection] = React.useState<CommercialWorkspaceSection>('overview');
  const [workspace, setWorkspace] = React.useState(bootstrap.workspace);
  const [onboarding, setOnboarding] = React.useState(bootstrap.onboarding);
  const [paymentSetupToken, setPaymentSetupToken] = React.useState(bootstrap.paymentSetupToken);
  const [invitePayload, setInvitePayload] = React.useState<InvitePayload | null>(null);
  const [inviteLoading, setInviteLoading] = React.useState(false);

  React.useEffect(() => {
    setWorkspace(bootstrap.workspace);
    setOnboarding(bootstrap.onboarding);
    setPaymentSetupToken(bootstrap.paymentSetupToken);
  }, [bootstrap]);

  const showAgreementReview =
    onboarding.step === 'agreement_review' || (previewMode && onboarding.agreementStatus === 'Pending');

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

  const handleStepComplete = React.useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  const projectName = workspace?.projectName ?? invitePayload?.deal.dealName ?? 'Your project';

  if (onboarding.step === 'awaiting_agreement_send' && !previewMode) {
    return (
      <AwaitingAgreementSend
        projectName={projectName}
        signedInEmail={signedInEmail}
        portalToken={portalToken}
        onSignOut={onSignOut}
      />
    );
  }

  if (showAgreementReview) {
    if (inviteLoading || !invitePayload) {
      return (
        <WorkspaceShell projectName={projectName} signedInEmail={signedInEmail} portalToken={portalToken} onSignOut={onSignOut}>
          <p className="text-sm text-muted-foreground text-center py-12">Loading your agreement…</p>
        </WorkspaceShell>
      );
    }

    return (
      <WorkspaceShell
        projectName={invitePayload.deal.dealName}
        signedInEmail={signedInEmail}
        portalToken={portalToken}
        onSignOut={onSignOut}
      >
        <ParticipantWorkspaceOnboardingProgress
          currentStep="agreement_review"
          nextRequiredAction={onboarding.nextRequiredAction}
        >
          <div className="space-y-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Referral Management
              </p>
              <h2 className="text-xl font-semibold mt-1">Hi {invitePayload.participant.name}</h2>
            </div>
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
                onApproved={handleStepComplete}
              />
            </div>
          </div>
        </ParticipantWorkspaceOnboardingProgress>
      </WorkspaceShell>
    );
  }

  if (onboarding.step === 'payout_details') {
    if (!paymentSetupToken) {
      return (
        <WorkspaceShell projectName={projectName} signedInEmail={signedInEmail} portalToken={portalToken} onSignOut={onSignOut}>
          <p className="text-sm text-muted-foreground text-center py-12">
            Preparing your payout form…
          </p>
        </WorkspaceShell>
      );
    }

    return (
      <WorkspaceShell projectName={projectName} signedInEmail={signedInEmail} portalToken={portalToken} onSignOut={onSignOut}>
        <ParticipantWorkspaceOnboardingProgress
          currentStep="payout_details"
          nextRequiredAction={onboarding.nextRequiredAction}
        >
          <ParticipantWorkspacePayoutPanel
            paymentSetupToken={paymentSetupToken}
            onSubmitted={handleStepComplete}
          />
        </ParticipantWorkspaceOnboardingProgress>
      </WorkspaceShell>
    );
  }

  if (onboarding.step === 'payout_submitted' && !workspace) {
    return (
      <PayoutSubmittedWaiting
        projectName={projectName}
        participantName={invitePayload?.participant.name ?? 'there'}
        signedInEmail={signedInEmail}
        portalToken={portalToken}
        onSignOut={onSignOut}
      />
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
      onboarding={onboarding}
      signedInEmail={signedInEmail}
      portalToken={portalToken}
      onSignOut={onSignOut}
    />
  );
}
