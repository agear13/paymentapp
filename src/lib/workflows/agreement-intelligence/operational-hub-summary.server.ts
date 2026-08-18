import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import type { CommercialGraphSnapshot } from '@/lib/ai-extractor/commercial-graph-types';
import type { ReviewFormState } from '@/lib/ai-extractor/review-form-types';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import {
  isOperationalWorkflow,
  showsOperationalHub,
  WORKFLOW_LIFECYCLE_LABELS,
} from '@/lib/workflows/agreement-intelligence/lifecycle';
import {
  buildNeedsAttention,
  buildOperationalActions,
  buildOperationalObligations,
  buildOperationalParticipants,
  buildSettlementSummary,
  buildUpcomingActions,
  buildWorkflowActivity,
  countParticipantKinds,
  isOperationalCoordinationBlocked,
} from '@/lib/workflows/agreement-intelligence/operational-hub-coordination.server';
import type { WorkflowOperationalHubSummary } from '@/lib/workflows/agreement-intelligence/types';

function resolveSettlementSchedule(input: {
  payoutTrigger?: string | null;
  extractionSettlement?: string | null;
}): string | null {
  return input.payoutTrigger?.trim() || input.extractionSettlement?.trim() || null;
}

export async function buildWorkflowOperationalHubSummary(input: {
  userId: string;
  lifecycleStatus: OrganizationWorkflowLifecycleStatus;
  pilotDealId: string | null;
  agreementTitle: string | null;
  extractionSettlement?: string | null;
  operatorApprovalRequired?: boolean;
  reviewForm?: ReviewFormState | null;
  commercialGraph?: CommercialGraphSnapshot | null;
  agreementMeta?: {
    createdAt: string | null;
    extractedAt: string | null;
    approvedAt: string | null;
    bootstrappedAt: string | null;
    sourceType: string | null;
  } | null;
  workflowDeploymentStatus?: 'DEPLOYED' | 'PAUSED';
}): Promise<WorkflowOperationalHubSummary> {
  const operatorApprovalRequired = input.operatorApprovalRequired ?? true;
  const settlementSchedule = input.extractionSettlement ?? null;
  const workflowDeploymentStatus = input.workflowDeploymentStatus ?? 'DEPLOYED';
  const coordinationBlocked = isOperationalCoordinationBlocked(workflowDeploymentStatus);
  const base: WorkflowOperationalHubSummary = {
    lifecycleStatus: input.lifecycleStatus,
    lifecycleLabel: WORKFLOW_LIFECYCLE_LABELS[input.lifecycleStatus] ?? input.lifecycleStatus,
    isOperational: isOperationalWorkflow(input.lifecycleStatus),
    isActivationComplete: input.lifecycleStatus === 'ACTIVE',
    pilotDealId: input.pilotDealId,
    agreementTitle: input.agreementTitle,
    participantCount: 0,
    obligationCount: 0,
    contractualPartyCount: 0,
    compensatedParticipantCount: 0,
    participants: [],
    obligations: [],
    needsAttention: [],
    actions: [],
    upcomingActions: [],
    settlement: buildSettlementSummary({
      schedule: settlementSchedule,
      operatorApprovalRequired,
    }),
    settlementSchedule,
    activity: [],
    projectParticipantsUrl: input.pilotDealId
      ? `/dashboard/projects/${encodeURIComponent(input.pilotDealId)}/participants`
      : null,
    workflowDeploymentStatus,
    coordinationBlocked,
  };

  if (!input.pilotDealId || !showsOperationalHub(input.lifecycleStatus)) {
    if (input.lifecycleStatus === 'BOOTSTRAP_FAILED') {
      base.upcomingActions.push({
        label: 'Bootstrap failed',
        detail: 'Retry activation to create participants and obligations from the approved structure.',
      });
    }
    return base;
  }

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const deal = snapshot.deals.find((row) => row.id === input.pilotDealId);
  const pilotParticipants = snapshot.participants.filter(
    (participant) => participant.dealId === input.pilotDealId
  );

  const obligationRows = await prisma.deal_network_pilot_obligations.findMany({
    where: { user_id: input.userId, deal_id: input.pilotDealId },
    orderBy: { created_at: 'asc' },
  });

  const resolvedSettlement = resolveSettlementSchedule({
    payoutTrigger: deal?.payoutTrigger,
    extractionSettlement: input.extractionSettlement,
  });

  const participants = buildOperationalParticipants({
    reviewForm: input.reviewForm ?? null,
    pilotParticipants,
    pilotDealId: input.pilotDealId,
    commercialGraph: input.commercialGraph ?? null,
    operatorApprovalRequired,
  });

  const counts = countParticipantKinds(participants);
  const settlement = buildSettlementSummary({
    schedule: resolvedSettlement,
    operatorApprovalRequired,
  });

  const obligations = buildOperationalObligations({
    participants: pilotParticipants,
    obligationRows,
    settlementCadence: resolvedSettlement,
    agreementOwner: input.commercialGraph?.agreementOwner ?? null,
  });

  const needsAttention = buildNeedsAttention({
    participants,
    obligations,
    settlement,
    operatorApprovalRequired,
  });

  if (coordinationBlocked) {
    needsAttention.unshift({
      id: 'workflow-paused',
      label: 'Workflow paused',
      detail: 'Resume the workflow to continue participant and settlement coordination.',
      participantId: null,
    });
  }

  const upcomingActions = buildUpcomingActions({
    participants,
    settlement,
    coordinationBlocked,
  });

  const actions = buildOperationalActions({
    participants,
    obligations,
    settlement,
    operatorApprovalRequired,
    coordinationBlocked,
  });

  const activity = buildWorkflowActivity({
    agreementTitle: input.agreementTitle,
    createdAt: input.agreementMeta?.createdAt ?? null,
    extractedAt: input.agreementMeta?.extractedAt ?? null,
    approvedAt: input.agreementMeta?.approvedAt ?? null,
    bootstrappedAt: input.agreementMeta?.bootstrappedAt ?? null,
    sourceType: input.agreementMeta?.sourceType ?? null,
    pilotParticipants,
    pilotDealId: input.pilotDealId,
  });

  return {
    ...base,
    participantCount: participants.length,
    obligationCount: obligations.length,
    contractualPartyCount: counts.contractualPartyCount,
    compensatedParticipantCount: counts.compensatedParticipantCount,
    participants,
    obligations,
    needsAttention,
    actions,
    upcomingActions,
    settlement,
    settlementSchedule: resolvedSettlement,
    activity,
  };
}
