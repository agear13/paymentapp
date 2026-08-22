'use client';

import * as React from 'react';
import { ArrowLeft, Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  PayoutStatusLine,
  ReferralStatusLine,
} from '@/components/journey/lovable/agreement-intelligence-participant-status';
import { ParticipantApprovalInviteDialog } from '@/components/journey/lovable/participant-approval-invite-dialog';
import { ParticipantIdentityEditDialog } from '@/components/journey/lovable/participant-identity-edit-dialog';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { participantInvitationCopy } from '@/lib/participants/participant-identity';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import type { WorkflowActivityItem, WorkflowOperationalParticipant } from '@/lib/workflows/agreement-intelligence/types';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

type Props = {
  participant: WorkflowOperationalParticipant;
  activity: WorkflowActivityItem[];
  coordinationBlocked: boolean;
  busy: boolean;
  autoOpenInvite?: boolean;
  showReferralManagementHandoff?: boolean;
  onBack: () => void;
  onAction: (
    action: ParticipantCoordinationAction,
    extra?: { missingFields?: string[]; requestedChanges?: string; sendInvitationEmail?: boolean }
  ) => Promise<{ ok: boolean; invitationEmailSent?: boolean } | boolean>;
  onIdentityUpdated?: () => void | Promise<void>;
  onAddReplacement?: () => void;
};

function copyText(value: string, success: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(success),
    () => toast.error('Could not copy')
  );
}

export function AgreementIntelligenceParticipantDetail({
  participant,
  activity,
  coordinationBlocked,
  busy,
  autoOpenInvite = false,
  showReferralManagementHandoff = true,
  onBack,
  onAction,
  onIdentityUpdated,
  onAddReplacement,
}: Props) {
  const participantActivity = activity.filter((entry) =>
    entry.id.includes(participant.id ?? '___never___')
  );
  const canAct = !coordinationBlocked && !busy && participant.partyKind === 'compensated_participant';
  const { isInstalled } = useDeployedWorkflows();
  const referralManagementHref = participant.id
    ? COMMERCIAL_OS_ROUTES.workflowParticipant('referral-management', participant.id)
    : COMMERCIAL_OS_ROUTES.workflowDetail('referral-management');
  const showReferralHandoff =
    showReferralManagementHandoff &&
    participant.partyKind === 'compensated_participant' &&
    participant.compensationKind !== 'fixed';
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  React.useEffect(() => {
    if (!autoOpenInvite) return;
    if (participant.agreementStatus === 'approved') return;
    setInviteOpen(true);
  }, [autoOpenInvite, participant.id, participant.agreementStatus]);
  const invitationSent =
    participant.agreementStatus === 'requested' || participant.agreementStatus === 'viewed';
  const invitation = participantInvitationCopy({
    email: participant.email,
    lastInvitationEmail: participant.lastInvitationEmail,
    agreementStatus: participant.agreementStatus,
  });
  const agreementApproved = participant.agreementStatus === 'approved';
  const payoutLocked = !agreementApproved;
  const workspaceReady =
    agreementApproved &&
    (participant.payoutSetupStatus === 'complete' || participant.payoutSetupStatus === 'not_applicable');
  const previewHref = participant.workspaceUrl
    ? `${participant.workspaceUrl}${participant.workspaceUrl.includes('?') ? '&' : '?'}mode=preview`
    : null;

  const copyApprovalLink = () => {
    setInviteOpen(true);
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to participants
      </button>

      <div>
        <h2 className="text-lg font-semibold">{participant.name}</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          {participant.partyKind === 'compensated_participant' ? 'Referral participant' : 'Participant'}
          {participant.operationalRole ? ` · ${participant.operationalRole}` : participant.commercialRole ? ` · ${participant.commercialRole}` : ''}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Participant details
          </p>
          {participant.id && participant.partyKind === 'compensated_participant' ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditOpen(true)}>
              Edit details
            </Button>
          ) : null}
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Name</dt>
            <dd className="mt-1 text-[14px] font-medium">{participant.name}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Email</dt>
            <dd className="mt-1 text-[14px] font-medium" data-testid="participant-identity-email">
              {participant.email?.trim() || 'No email on file'}
            </dd>
            {participant.identityBound ? (
              <p className="mt-1 text-[12px] text-ink-soft">Verified participant identity</p>
            ) : null}
          </div>
        </dl>
        {participant.compensationLabel ? (
          <p className="text-[14px] font-medium">{participant.compensationLabel}</p>
        ) : null}
        {participant.identityBound && onAddReplacement ? (
          <p className="text-[13px] text-ink-soft">
            Email cannot be changed after the participant signs in.{' '}
            <button type="button" className="font-medium text-primary" onClick={onAddReplacement}>
              Add a new participant instead
            </button>
          </p>
        ) : null}
      </div>

      {participant.partyKind === 'contractual_party' ? (
        <div className="rounded-xl border border-border bg-secondary/10 p-4 text-[14px] text-ink-soft">
          This party is contractual only. Payout setup and referral activation are not required.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Participant onboarding
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-[13px] font-medium">1. Agreement</p>
                <div className="mt-1 space-y-1">
                  <p className="text-[13px] font-medium">{invitation.headline}</p>
                  {invitation.destinationEmail ? (
                    <p className="text-[14px] font-medium" data-testid="invitation-destination-email">
                      {invitation.destinationEmail}
                    </p>
                  ) : null}
                  <p className="text-[13px] text-ink-soft">{invitation.statusLine}</p>
                  {invitation.previousDestinationEmail ? (
                    <p className="text-[13px] text-ink-soft">
                      Previous invitation was sent to {invitation.previousDestinationEmail}.
                    </p>
                  ) : null}
                </div>
              </div>
              {canAct && !agreementApproved ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => setInviteOpen(true)}>
                    {invitation.stale || invitationSent ? 'Resend invitation' : 'Send invitation'}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={copyApprovalLink}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy approval link
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-1 border-t border-border pt-3">
              <p className="text-[13px] font-medium">2. Payout details</p>
              {payoutLocked ? (
                <p className="text-[13px] text-ink-soft">Locked until agreement approval</p>
              ) : (
                <PayoutStatusLine participant={participant} />
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-[13px] font-medium">3. Workspace</p>
              <p className="text-[13px] text-ink-soft">
                {workspaceReady
                  ? 'Available — participant can use the full commercial workspace'
                  : 'Available after onboarding'}
              </p>
              {previewHref ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={previewHref} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Preview participant workspace
                  </a>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Payout details</p>
              <div className="mt-2">
                <PayoutStatusLine participant={participant} />
              </div>
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Tax information</p>
              <p className="mt-1 text-[13px] text-ink-soft">
                {participant.taxInformationStatus === 'complete'
                  ? 'Complete'
                  : participant.taxInformationStatus === 'incomplete'
                    ? 'Incomplete'
                    : 'Required'}
              </p>
            </div>
            {participant.payoutReview?.submittedAt ? (
              <div className="space-y-1 text-[13px] text-ink-soft">
                <p>Preferred method: {participant.payoutReview.preferredMethod ?? 'Not provided'}</p>
                <p>ABN: {participant.payoutReview.abn ?? 'Not provided'}</p>
                <p>GST: {participant.payoutReview.gst ?? 'Not provided'}</p>
              </div>
            ) : null}
            {participant.missingPayoutFields.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[13px]">
                <p className="font-medium">Missing</p>
                <ul className="mt-1 list-disc pl-4 text-ink-soft">
                  {participant.missingPayoutFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canAct && participant.nextActionKind === 'request_payout_details' ? (
              <Button type="button" disabled={busy} onClick={() => void onAction('request_payout_details')}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Request payout details
              </Button>
            ) : null}
            {canAct && participant.nextActionKind === 'review_payout_details' ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void onAction('approve_payout_details')}>
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void onAction('flag_payout_details', {
                      missingFields: participant.missingPayoutFields,
                    })
                  }
                >
                  Flag missing information
                </Button>
              </div>
            ) : null}
            {canAct && participant.nextActionKind === 'request_update' ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onAction('flag_payout_details', {
                    missingFields: participant.missingPayoutFields,
                  })
                }
              >
                Request update
              </Button>
            ) : null}
            <p className="text-[12px] text-ink-soft">
              Completing payout details does not execute payment. Settlement stays behind existing approval gates.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Referral</p>
              <div className="mt-2">
                <ReferralStatusLine participant={participant} />
              </div>
            </div>
            {participant.compensationKind === 'fixed' ? (
              <p className="text-[13px] text-ink-soft">Fixed payment. No referral link required.</p>
            ) : null}
            {participant.referralStatus === 'service_required' ? (
              <p className="text-[13px] text-amber-800 dark:text-amber-300">
                Referral setup — service selection required. A destination will not be fabricated.
              </p>
            ) : null}
            {participant.referral?.commissionLabel ? (
              <p className="text-[13px] text-ink-soft">Commission: {participant.referral.commissionLabel}</p>
            ) : null}
            {participant.referral?.destinationLabel ? (
              <p className="text-[13px] text-ink-soft">Destination: {participant.referral.destinationLabel}</p>
            ) : null}
            {participant.referral?.url ? (
              <div className="space-y-3">
                {participant.referral.qrUrl ? (
                  <img
                    src={participant.referral.qrUrl}
                    alt={`${participant.name} referral QR code`}
                    className="h-40 w-40 rounded-lg border border-border bg-white p-2"
                  />
                ) : null}
                <p className="break-all text-[13px] font-medium">{participant.referral.url}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(participant.referral?.url ?? '', 'Referral link copied')}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  {participant.referral.qrUrl ? (
                    <a
                      href={participant.referral.qrUrl}
                      download={`${participant.name.replace(/\s+/g, '-').toLowerCase()}-referral-qr.png`}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-secondary/20"
                    >
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download QR
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
            {canAct && participant.nextActionKind === 'activate_referral' && participant.referralStatus === 'ready' ? (
              <Button type="button" disabled={busy} onClick={() => void onAction('activate_referral')}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Activate referral
              </Button>
            ) : null}
            {showReferralHandoff ? (
              <p className="text-[13px]">
                <span className="text-ink-soft">Referral relationship detected. </span>
                <Link href={referralManagementHref} className="font-medium text-primary">
                  {isInstalled('referral-management')
                    ? 'Activate in Referral Management'
                    : 'Open Referral Management'}
                </Link>
              </p>
            ) : null}
          </div>
        </>
      )}

      {participantActivity.length > 0 ? (
        <div className="rounded-xl border border-border bg-secondary/10 p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Activity</p>
          <ul className="mt-3 space-y-2">
            {participantActivity.map((entry) => (
              <li key={entry.id} className="text-[13px]">
                <span className="font-medium">{entry.label}</span>
                {entry.detail ? <span className="text-ink-soft"> — {entry.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {participant.id ? (
        <ParticipantApprovalInviteDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          participantId={participant.id}
          participantName={participant.name}
          participantEmail={participant.email}
          busy={busy}
          onAction={onAction}
        />
      ) : null}
      {participant.id ? (
        <ParticipantIdentityEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          participantId={participant.id}
          name={participant.name}
          email={participant.email}
          identityBound={participant.identityBound}
          onSaved={() => onIdentityUpdated?.()}
        />
      ) : null}
    </div>
  );
}
