'use client';

import { ArrowLeft, Copy, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AgreementStatusLine,
  PayoutStatusLine,
  ReferralStatusLine,
} from '@/components/journey/lovable/agreement-intelligence-participant-status';
import { COMMERCIAL_OS_ROUTES } from '@/lib/journey/commercial-os-routes';
import { useDeployedWorkflows } from '@/hooks/use-deployed-workflows';
import type { WorkflowActivityItem, WorkflowOperationalParticipant } from '@/lib/workflows/agreement-intelligence/types';
import type { ParticipantCoordinationAction } from '@/lib/workflows/agreement-intelligence/participant-coordination';

type Props = {
  participant: WorkflowOperationalParticipant;
  activity: WorkflowActivityItem[];
  coordinationBlocked: boolean;
  busy: boolean;
  showReferralManagementHandoff?: boolean;
  onBack: () => void;
  onAction: (
    action: ParticipantCoordinationAction,
    extra?: { missingFields?: string[]; requestedChanges?: string }
  ) => Promise<boolean>;
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
  showReferralManagementHandoff = true,
  onBack,
  onAction,
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
          {participant.commercialRole ?? 'Role not captured'}
          {participant.operationalRole ? ` · ${participant.operationalRole}` : ''}
        </p>
        {participant.compensationLabel ? (
          <p className="mt-2 text-[14px] font-medium">{participant.compensationLabel}</p>
        ) : null}
      </div>

      {participant.partyKind === 'contractual_party' ? (
        <div className="rounded-xl border border-border bg-secondary/10 p-4 text-[14px] text-ink-soft">
          This party is contractual only. Payout setup and referral activation are not required.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Agreement</p>
              <div className="mt-2">
                <AgreementStatusLine participant={participant} />
              </div>
            </div>
            {canAct && participant.nextActionKind === 'request_approval' ? (
              <Button type="button" disabled={busy} onClick={() => void onAction('request_approval')}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Request approval
              </Button>
            ) : null}
            {participant.workspaceUrl ? (
              <p className="text-[12px] text-ink-soft">
                Participant workspace:{' '}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => copyText(window.location.origin + participant.workspaceUrl, 'Workspace link copied')}
                >
                  Copy link
                </button>
              </p>
            ) : null}
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
    </div>
  );
}
