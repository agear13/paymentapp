'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import type {
  WorkflowCoordinationPayoutStatus,
  WorkflowCoordinationReferralStatus,
  WorkflowOperationalParticipant,
} from '@/lib/workflows/agreement-intelligence/types';

function StatusMark({
  tone,
  label,
}: {
  tone: 'complete' | 'attention' | 'pending' | 'neutral';
  label: string;
}) {
  const icon =
    tone === 'complete' ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
    ) : tone === 'attention' ? (
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
    ) : (
      <Circle className="h-3.5 w-3.5 text-ink-soft" />
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      {icon}
      <span className="text-ink-soft">{label}</span>
    </span>
  );
}

export function agreementTone(
  participant: WorkflowOperationalParticipant
): 'complete' | 'attention' | 'pending' | 'neutral' {
  if (participant.partyKind === 'contractual_party') return 'neutral';
  if (participant.agreementStatus === 'approved') return 'complete';
  return 'attention';
}

export function payoutTone(
  status: WorkflowCoordinationPayoutStatus
): 'complete' | 'attention' | 'pending' | 'neutral' {
  if (status === 'complete') return 'complete';
  if (status === 'not_applicable') return 'neutral';
  if (status === 'submitted') return 'attention';
  return 'attention';
}

export function referralTone(
  status: WorkflowCoordinationReferralStatus
): 'complete' | 'attention' | 'pending' | 'neutral' {
  if (status === 'active') return 'complete';
  if (status === 'not_applicable') return 'neutral';
  if (status === 'service_required') return 'attention';
  return 'pending';
}

export function AgreementStatusLine({ participant }: { participant: WorkflowOperationalParticipant }) {
  if (participant.partyKind === 'contractual_party') {
    return <StatusMark tone="neutral" label="Contractual party" />;
  }
  const label =
    participant.agreementStatus === 'approved'
      ? 'Approved'
      : participant.agreementStatus === 'requested' || participant.agreementStatus === 'viewed'
        ? 'Approval requested'
        : 'Approval required';
  return <StatusMark tone={agreementTone(participant)} label={label} />;
}

export function PayoutStatusLine({ participant }: { participant: WorkflowOperationalParticipant }) {
  const labels: Record<WorkflowCoordinationPayoutStatus, string> = {
    not_applicable: 'Not required',
    required: 'Required',
    requested: 'Requested',
    submitted: 'Submitted — review required',
    flagged: 'Action required',
    complete: 'Complete',
  };
  return <StatusMark tone={payoutTone(participant.payoutSetupStatus)} label={labels[participant.payoutSetupStatus]} />;
}

export function ReferralStatusLine({ participant }: { participant: WorkflowOperationalParticipant }) {
  if (participant.referralStatus === 'not_applicable') {
    return <StatusMark tone="neutral" label="No referral link required" />;
  }
  const labels: Record<WorkflowCoordinationReferralStatus, string> = {
    not_applicable: 'Not required',
    not_configured: 'Not configured',
    service_required: 'Service selection required',
    ready: 'Ready to activate',
    active: 'Active',
  };
  return <StatusMark tone={referralTone(participant.referralStatus)} label={labels[participant.referralStatus]} />;
}

export function ParticipantCoordinationSummary({
  participant,
}: {
  participant: WorkflowOperationalParticipant;
}) {
  if (participant.partyKind === 'contractual_party') {
    return (
      <p className="mt-2 text-[13px] text-ink-soft">
        Contractual party — not included in payout or referral setup.
      </p>
    );
  }

  return (
    <div className="mt-3 grid gap-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Agreement</span>
        <AgreementStatusLine participant={participant} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Payout setup</span>
        <PayoutStatusLine participant={participant} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-soft">Referral</span>
        <ReferralStatusLine participant={participant} />
      </div>
      {participant.nextActionLabel ? (
        <p className="mt-1 text-[13px]">
          <span className="font-medium">Next:</span>{' '}
          <span className="text-ink-soft">{participant.nextActionLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
