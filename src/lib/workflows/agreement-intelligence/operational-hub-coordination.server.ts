import 'server-only';

import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { CommercialGraphSnapshot } from '@/lib/ai-extractor/commercial-graph-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import {
  deriveParticipantLifecycleAction,
  deriveParticipantOperationalWorkflow,
  formatParticipantStatusLabel,
} from '@/lib/commercial/participant-commercial-lifecycle';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';
import { deriveAuditTimelineFromParticipants } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import type {
  WorkflowActivityItem,
  WorkflowNeedsAttentionItem,
  WorkflowOperationalAction,
  WorkflowOperationalObligation,
  WorkflowOperationalParticipant,
  WorkflowSettlementSummary,
} from '@/lib/workflows/agreement-intelligence/types';
import { participantSetupStatusLabel } from '@/lib/workflows/agreement-intelligence/participant-setup.server';
import {
  buildParticipantCoordinationView,
  emptyContractualCoordination,
  workflowParticipantHref,
  type CoordinationCatalogItem,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';

function obligationStatusLabel(approvalStatus: string | undefined | null): string {
  if (approvalStatus === 'Approved') return 'Active';
  return approvalStatus ?? 'Pending approval';
}

/** Deployment pause blocks coordination actions; visibility remains available. */
export function isOperationalCoordinationBlocked(deploymentStatus: 'DEPLOYED' | 'PAUSED'): boolean {
  return deploymentStatus === 'PAUSED';
}

function participantHasCompensation(participant: DemoParticipant): boolean {
  const profile = participant.compensationProfile;
  if (profile?.compensationType === 'REVENUE_SHARE' && (profile.percentage ?? 0) > 0) {
    return true;
  }
  if (profile?.compensationType === 'FIXED_FEE' && (profile.fixedAmount ?? 0) > 0) {
    return true;
  }
  return participant.commissionKind === 'pct_deal_value' && participant.commissionValue > 0;
}

function buildContractualParties(input: {
  reviewForm: ReviewFormState | null;
  pilotParticipants: DemoParticipant[];
  pilotDealId: string;
  commercialGraph: CommercialGraphSnapshot | null;
  operatorApprovalRequired: boolean;
  catalogItems: CoordinationCatalogItem[];
}): WorkflowOperationalParticipant[] {
  const compensatedByKey = new Map<string, DemoParticipant>();
  for (const participant of input.pilotParticipants) {
    compensatedByKey.set(participant.name.trim().toLowerCase(), participant);
    compensatedByKey.set(participant.id, participant);
  }

  const reviewParties = input.reviewForm?.parties ?? [];
  const rows: WorkflowOperationalParticipant[] = [];

  for (const party of reviewParties) {
    const name = party.name.trim();
    if (!name) continue;

    const matched =
      compensatedByKey.get(name.toLowerCase()) ??
      compensatedByKey.get(party.id) ??
      null;

    if (matched) {
      rows.push(mapCompensatedParticipant(matched, party.role, input.operatorApprovalRequired, input.catalogItems));
      continue;
    }

    rows.push({
      id: null,
      name,
      commercialRole: party.role?.trim() || null,
      operationalRole: null,
      partyKind: 'contractual_party',
      statusLabel: 'Contractual party',
      approvalStatus: null,
      onboardingStatus: null,
      needsAttention: false,
      attentionReason: null,
      manageUrl: null,
      ...emptyContractualCoordination(),
    });
  }

  if (rows.length === 0 && input.commercialGraph?.agreementOwner) {
    const owner = input.commercialGraph.agreementOwner.trim();
    if (owner && !compensatedByKey.has(owner.toLowerCase())) {
      rows.push({
        id: null,
        name: owner,
        commercialRole: 'Agreement owner',
        operationalRole: null,
        partyKind: 'contractual_party',
        statusLabel: 'Contractual party',
        approvalStatus: null,
        onboardingStatus: null,
        needsAttention: false,
        attentionReason: null,
        manageUrl: null,
        ...emptyContractualCoordination(),
      });
    }
  }

  for (const participant of input.pilotParticipants) {
    const alreadyListed = rows.some(
      (row) => row.id === participant.id || row.name.toLowerCase() === participant.name.toLowerCase()
    );
    if (!alreadyListed) {
      rows.push(
        mapCompensatedParticipant(
          participant,
          input.reviewForm?.parties.find(
            (party) => party.name.trim().toLowerCase() === participant.name.trim().toLowerCase()
          )?.role ?? null,
          input.operatorApprovalRequired,
          input.catalogItems
        )
      );
    }
  }

  return rows;
}

function mapCompensatedParticipant(
  participant: DemoParticipant,
  commercialRole: string | null | undefined,
  operatorApprovalRequired: boolean,
  catalogItems: CoordinationCatalogItem[]
): WorkflowOperationalParticipant {
  const workflow = deriveParticipantOperationalWorkflow(participant);
  const lifecycleAction = deriveParticipantLifecycleAction(participant);
  const onboardingStatus = effectiveOnboardingStatus(participant);
  const needsAttention =
    lifecycleAction.urgency === 'attention' || lifecycleAction.urgency === 'action_required';
  const setupLabel = participantSetupStatusLabel(participant, operatorApprovalRequired);
  const coordination = buildParticipantCoordinationView(participant, {
    catalogItems,
    operatorApprovalRequired,
  });

  return {
    id: participant.id,
    name: participant.name,
    commercialRole: commercialRole?.trim() || null,
    operationalRole: participant.role,
    partyKind: 'compensated_participant',
    statusLabel:
      setupLabel === 'Ready'
        ? formatParticipantStatusLabel(workflow.stage)
        : setupLabel,
    approvalStatus: participant.approvalStatus ?? null,
    onboardingStatus,
    needsAttention,
    attentionReason: needsAttention ? lifecycleAction.description : null,
    manageUrl: workflowParticipantHref(participant.id),
    ...coordination,
  };
}

export function buildOperationalObligations(input: {
  participants: DemoParticipant[];
  obligationRows: Array<{
    id: string;
    obligation_type: string;
    amount_owed: unknown;
    currency: string;
    status: string;
    participant_id: string | null;
  }>;
  settlementCadence: string | null;
  agreementOwner: string | null;
}): WorkflowOperationalObligation[] {
  const participantObligationLabels = input.participants.flatMap((participant) => {
    const profile = participant.compensationProfile;
    const revenueShare = profile?.percentage;
    if (
      profile?.compensationType === 'REVENUE_SHARE' &&
      typeof revenueShare === 'number' &&
      revenueShare > 0
    ) {
      return [
        {
          id: `${participant.id}-revenue-share`,
          label: `${participant.name} revenue share`,
          amountLabel: `${revenueShare}%`,
          status: obligationStatusLabel(participant.approvalStatus),
          type: 'revenue_share',
          beneficiary: participant.name,
          obligor: input.agreementOwner,
          cadence: input.settlementCadence,
          nextAction:
            participant.approvalStatus === 'Approved'
              ? 'Monitor settlement readiness'
              : 'Complete participant approval',
        },
      ];
    }
    const fixedAmount = profile?.fixedAmount;
    if (
      profile?.compensationType === 'FIXED_FEE' &&
      typeof fixedAmount === 'number' &&
      fixedAmount > 0
    ) {
      return [
        {
          id: `${participant.id}-fixed-fee`,
          label: `${participant.name} fixed fee`,
          amountLabel: `$${fixedAmount.toLocaleString()}`,
          status: obligationStatusLabel(participant.approvalStatus),
          type: 'fixed_fee',
          beneficiary: participant.name,
          obligor: input.agreementOwner,
          cadence: input.settlementCadence,
          nextAction:
            participant.approvalStatus === 'Approved'
              ? 'Monitor settlement readiness'
              : 'Complete participant approval',
        },
      ];
    }
    if (participant.commissionKind === 'pct_deal_value' && participant.commissionValue > 0) {
      return [
        {
          id: `${participant.id}-commission`,
          label: `${participant.name} revenue share`,
          amountLabel: `${participant.commissionValue}%`,
          status: obligationStatusLabel(participant.approvalStatus),
          type: 'revenue_share',
          beneficiary: participant.name,
          obligor: input.agreementOwner,
          cadence: input.settlementCadence,
          nextAction:
            participant.approvalStatus === 'Approved'
              ? 'Monitor settlement readiness'
              : 'Complete participant approval',
        },
      ];
    }
    return [];
  });

  if (participantObligationLabels.length > 0) {
    return participantObligationLabels;
  }

  return input.obligationRows.map((row) => {
    const participant = input.participants.find((p) => p.id === row.participant_id);
    return {
      id: row.id,
      label: row.obligation_type.replace(/_/g, ' '),
      amountLabel: `${row.currency} ${Number(row.amount_owed).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`,
      status: row.status,
      type: row.obligation_type,
      beneficiary: participant?.name ?? 'Participant',
      obligor: input.agreementOwner,
      cadence: input.settlementCadence,
      nextAction: 'Review obligation status',
    };
  });
}

export function buildNeedsAttention(input: {
  participants: WorkflowOperationalParticipant[];
  obligations: WorkflowOperationalObligation[];
  settlement: WorkflowSettlementSummary;
  operatorApprovalRequired: boolean;
}): WorkflowNeedsAttentionItem[] {
  const items: WorkflowNeedsAttentionItem[] = [];
  const compensated = input.participants.filter(
    (participant) => participant.partyKind === 'compensated_participant'
  );
  const payoutRequired = compensated.filter(
    (participant) =>
      participant.agreementStatus === 'approved' &&
      (participant.payoutSetupStatus === 'required' || participant.payoutSetupStatus === 'flagged')
  );
  if (payoutRequired.length > 0) {
    items.push({
      id: 'payout-setup-group',
      label:
        payoutRequired.length === 1
          ? `${payoutRequired[0].name} requires payout setup`
          : `${payoutRequired.length} participants require payout setup`,
      detail: 'Collect payout and tax details before settlement.',
      participantId: payoutRequired.length === 1 ? payoutRequired[0].id : null,
      href: payoutRequired.length === 1 && payoutRequired[0].id
        ? workflowParticipantHref(payoutRequired[0].id)
        : '#participants',
    });
  }

  for (const participant of compensated) {
    if (participant.partyKind !== 'compensated_participant') continue;
    if (participant.approvalStatus === 'Pending approval') {
      items.push({
        id: `approval-${participant.id ?? participant.name}`,
        label: `${participant.name} — approval required`,
        detail: 'Share the participation agreement and collect approval before release.',
        participantId: participant.id,
        href: participant.id ? workflowParticipantHref(participant.id) : '#participants',
      });
    } else if (participant.onboardingStatus === 'NOT_STARTED' || participant.onboardingStatus === 'INCOMPLETE') {
      items.push({
        id: `onboarding-${participant.id ?? participant.name}`,
        label: `${participant.name} — onboarding incomplete`,
        detail: 'Collect payout and supplier details before settlement.',
        participantId: participant.id,
        href: participant.id ? workflowParticipantHref(participant.id) : '#participants',
      });
    } else if (participant.needsAttention && participant.attentionReason) {
      items.push({
        id: `attention-${participant.id ?? participant.name}`,
        label: `${participant.name} — ${participant.statusLabel}`,
        detail: participant.attentionReason,
        participantId: participant.id,
        href: participant.id ? workflowParticipantHref(participant.id) : '#participants',
      });
    }
  }

  if (input.settlement.schedule && input.settlement.approvalRequired) {
    items.push({
      id: 'settlement-approval',
      label: 'Settlement — operator approval required',
      detail: input.settlement.schedule,
      participantId: null,
    });
  }

  const pendingObligations = input.obligations.filter(
    (obligation) => obligation.status !== 'Approved' && obligation.status !== 'PAID'
  );
  if (pendingObligations.length > 0 && items.length === 0) {
    items.push({
      id: 'obligations-review',
      label: 'Review obligation readiness',
      detail: `${pendingObligations.length} obligation(s) still require operator or participant action.`,
      participantId: null,
    });
  }

  items.push({
    id: 'funding-required',
    label: 'Funding required',
    detail: 'No payments execute automatically from agreement approval.',
    participantId: null,
  });

  return items;
}

export function buildUpcomingActions(input: {
  participants: WorkflowOperationalParticipant[];
  settlement: WorkflowSettlementSummary;
  coordinationBlocked?: boolean;
}): Array<{ label: string; detail: string; participantId?: string | null }> {
  if (input.coordinationBlocked) {
    return [
      {
        label: 'Workflow paused',
        detail: 'Resume the workflow to continue participant and settlement coordination.',
        participantId: null,
      },
    ];
  }

  const actions: Array<{ label: string; detail: string; participantId?: string | null }> = [];

  for (const participant of input.participants) {
    if (participant.partyKind !== 'compensated_participant' || !participant.id) continue;
    if (participant.approvalStatus === 'Pending approval') {
      actions.push({
        label: `Review ${participant.name} approval`,
        detail: 'Send or follow up on the participation agreement.',
        participantId: participant.id,
      });
    } else if (
      participant.onboardingStatus === 'NOT_STARTED' ||
      participant.onboardingStatus === 'INCOMPLETE'
    ) {
      actions.push({
        label: `Complete ${participant.name} onboarding`,
        detail: 'Collect payout details before any release.',
        participantId: participant.id,
      });
    }
  }

  if (input.settlement.schedule) {
    actions.push({
      label: 'Review upcoming settlement',
      detail: input.settlement.schedule,
      participantId: null,
    });
  }

  actions.push({
    label: 'Confirm funding',
    detail: 'Link funding before executing any release.',
    participantId: null,
  });

  return actions;
}

export function buildWorkflowActivity(input: {
  agreementTitle: string | null;
  createdAt: string | null;
  extractedAt: string | null;
  approvedAt: string | null;
  bootstrappedAt: string | null;
  sourceType: string | null;
  pilotParticipants: DemoParticipant[];
  pilotDealId: string;
}): WorkflowActivityItem[] {
  const items: WorkflowActivityItem[] = [];

  if (input.createdAt) {
    items.push({
      id: 'agreement-uploaded',
      label: input.sourceType === 'PASTE' ? 'Agreement pasted' : 'Agreement uploaded',
      detail: input.agreementTitle,
      timestamp: input.createdAt,
    });
  }
  if (input.extractedAt) {
    items.push({
      id: 'extraction-completed',
      label: 'AI extraction completed',
      detail: 'Commercial structure extracted for review.',
      timestamp: input.extractedAt,
    });
  }
  if (input.approvedAt) {
    items.push({
      id: 'structure-approved',
      label: 'Structure approved',
      detail: 'Operator approved the extracted commercial structure.',
      timestamp: input.approvedAt,
    });
  }
  if (input.bootstrappedAt) {
    items.push({
      id: 'workflow-activated',
      label: 'Commercial graph activated',
      detail: 'Participants and obligations were created from the approved structure.',
      timestamp: input.bootstrappedAt,
    });
  }

  const participantEvents = deriveAuditTimelineFromParticipants(
    input.pilotParticipants,
    input.pilotDealId
  ).map((entry) => ({
    id: entry.id,
    label: entry.title,
    detail: entry.description,
    timestamp: entry.timestamp,
  }));

  return [...items, ...participantEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function buildSettlementSummary(input: {
  schedule: string | null;
  operatorApprovalRequired: boolean;
}): WorkflowSettlementSummary {
  return {
    schedule: input.schedule,
    approvalRequired: input.operatorApprovalRequired,
    // P3-D: do not fabricate calendar dates; only show when computed from persisted schedule data.
    nextSettlementLabel: null,
  };
}

export function buildOperationalActions(input: {
  participants: WorkflowOperationalParticipant[];
  obligations: WorkflowOperationalObligation[];
  settlement: WorkflowSettlementSummary;
  operatorApprovalRequired: boolean;
  coordinationBlocked?: boolean;
}): WorkflowOperationalAction[] {
  if (input.coordinationBlocked) {
    return [];
  }

  const actions: WorkflowOperationalAction[] = [];

  for (const participant of input.participants) {
    if (participant.partyKind !== 'compensated_participant' || !participant.id) continue;

    if (input.operatorApprovalRequired && participant.approvalStatus === 'Pending approval') {
      actions.push({
        id: `invite-${participant.id}`,
        label: `Request approval for ${participant.name}`,
        detail: 'Share the participation agreement for approval.',
        disposition: 'REQUIRES_APPROVAL',
        participantId: participant.id,
        kind: 'request_approval',
        href: workflowParticipantHref(participant.id),
      });
    } else if (participant.payoutSetupStatus === 'submitted') {
      actions.push({
        id: `review-payout-${participant.id}`,
        label: `Review ${participant.name} payout details`,
        detail: 'Submitted payout and tax information needs operator review.',
        disposition: 'REQUIRES_APPROVAL',
        participantId: participant.id,
        kind: 'review_payout_details',
        href: workflowParticipantHref(participant.id),
      });
    } else if (participant.payoutSetupStatus === 'flagged') {
      actions.push({
        id: `update-payout-${participant.id}`,
        label: `Request update from ${participant.name}`,
        detail: participant.missingPayoutFields.length
          ? `Missing: ${participant.missingPayoutFields.join(', ')}`
          : 'Payout details were flagged for update.',
        disposition: 'REQUIRES_APPROVAL',
        participantId: participant.id,
        kind: 'request_update',
        href: workflowParticipantHref(participant.id),
      });
    } else if (
      participant.payoutSetupStatus === 'required' ||
      participant.payoutSetupStatus === 'requested' ||
      participant.onboardingStatus === 'NOT_STARTED' ||
      participant.onboardingStatus === 'INCOMPLETE'
    ) {
      actions.push({
        id: `onboard-${participant.id}`,
        label: `Request payout details from ${participant.name}`,
        detail: 'Collect payout and supplier details before release.',
        disposition: 'REQUIRES_APPROVAL',
        participantId: participant.id,
        kind: 'request_payout_details',
        href: workflowParticipantHref(participant.id),
      });
    } else if (participant.referralStatus === 'ready') {
      actions.push({
        id: `referral-${participant.id}`,
        label: `Activate referral for ${participant.name}`,
        detail: participant.compensationLabel ?? 'Generate the participant referral link.',
        disposition: 'READY',
        participantId: participant.id,
        kind: 'activate_referral',
        href: workflowParticipantHref(participant.id),
      });
    }
  }

  for (const obligation of input.obligations) {
    actions.push({
      id: `obligation-${obligation.id}`,
      label: `Review ${obligation.label}`,
      detail: `${obligation.amountLabel} · ${obligation.status}`,
      disposition: obligation.status === 'Approved' ? 'READY' : 'PROPOSED',
      participantId: null,
    });
  }

  if (input.settlement.schedule) {
    actions.push({
      id: 'settlement-review',
      label: 'Settlement approaching',
      detail: input.settlement.schedule,
      disposition: input.settlement.approvalRequired ? 'REQUIRES_APPROVAL' : 'PROPOSED',
      participantId: null,
    });
  }

  actions.push({
    id: 'funding-required',
    label: 'Funding required',
    detail: 'No payments execute automatically from agreement approval.',
    disposition: 'PROPOSED',
    participantId: null,
  });

  return actions;
}

export function buildOperationalParticipants(input: {
  reviewForm: ReviewFormState | null;
  pilotParticipants: DemoParticipant[];
  pilotDealId: string;
  commercialGraph: CommercialGraphSnapshot | null;
  operatorApprovalRequired: boolean;
  catalogItems?: CoordinationCatalogItem[];
}): WorkflowOperationalParticipant[] {
  return buildContractualParties({
    ...input,
    catalogItems: input.catalogItems ?? [],
  });
}

export function countParticipantKinds(participants: WorkflowOperationalParticipant[]): {
  contractualPartyCount: number;
  compensatedParticipantCount: number;
} {
  return {
    contractualPartyCount: participants.filter((row) => row.partyKind === 'contractual_party')
      .length,
    compensatedParticipantCount: participants.filter(
      (row) => row.partyKind === 'compensated_participant'
    ).length,
  };
}

export function participantHasCompensationTerms(participant: DemoParticipant): boolean {
  return participantHasCompensation(participant);
}
