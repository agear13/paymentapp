import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import type { OrganizationWorkflowLifecycleStatus } from '@prisma/client';
import { WORKFLOW_LIFECYCLE_LABELS } from '@/lib/workflows/agreement-intelligence/lifecycle';
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
}): Promise<WorkflowOperationalHubSummary> {
  const base: WorkflowOperationalHubSummary = {
    lifecycleStatus: input.lifecycleStatus,
    lifecycleLabel: WORKFLOW_LIFECYCLE_LABELS[input.lifecycleStatus] ?? input.lifecycleStatus,
    isOperational: input.lifecycleStatus === 'ACTIVE',
    pilotDealId: input.pilotDealId,
    agreementTitle: input.agreementTitle,
    participantCount: 0,
    obligationCount: 0,
    participants: [],
    obligations: [],
    upcomingActions: [],
    settlementSchedule: input.extractionSettlement ?? null,
  };

  if (!input.pilotDealId || input.lifecycleStatus !== 'ACTIVE') {
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
  const participants = snapshot.participants.filter(
    (participant) => participant.dealId === input.pilotDealId
  );

  const obligationRows = await prisma.deal_network_pilot_obligations.findMany({
    where: { user_id: input.userId, deal_id: input.pilotDealId },
    orderBy: { created_at: 'asc' },
  });

  const participantObligationLabels = participants.flatMap((participant) => {
    const profile = participant.compensationProfile;
    const revenueShare = profile?.percentage;
    if (profile?.compensationType === 'REVENUE_SHARE' && typeof revenueShare === 'number' && revenueShare > 0) {
      return [
        {
          id: `${participant.id}-revenue-share`,
          label: `${participant.name} revenue share`,
          amountLabel: `${revenueShare}%`,
          status: participant.approvalStatus ?? 'Pending approval',
        },
      ];
    }
    const fixedAmount = profile?.fixedAmount;
    if (profile?.compensationType === 'FIXED_FEE' && typeof fixedAmount === 'number' && fixedAmount > 0) {
      return [
        {
          id: `${participant.id}-fixed-fee`,
          label: `${participant.name} fixed fee`,
          amountLabel: `$${fixedAmount.toLocaleString()}`,
          status: participant.approvalStatus ?? 'Pending approval',
        },
      ];
    }
    if (participant.commissionKind === 'pct_deal_value' && participant.commissionValue > 0) {
      return [
        {
          id: `${participant.id}-commission`,
          label: `${participant.name} revenue share`,
          amountLabel: `${participant.commissionValue}%`,
          status: participant.approvalStatus ?? 'Pending approval',
        },
      ];
    }
    return [];
  });

  const obligations: WorkflowOperationalHubSummary['obligations'] =
    participantObligationLabels.length > 0
      ? participantObligationLabels
      : obligationRows.map((row) => ({
          id: row.id,
          label: row.obligation_type.replace(/_/g, ' '),
          amountLabel: `${row.currency} ${Number(row.amount_owed).toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`,
          status: row.status,
        }));

  const settlementSchedule = resolveSettlementSchedule({
    payoutTrigger: deal?.payoutTrigger,
    extractionSettlement: input.extractionSettlement,
  });

  const upcomingActions: WorkflowOperationalHubSummary['upcomingActions'] = [];
  if (settlementSchedule) {
    upcomingActions.push({
      label: 'Next settlement',
      detail: settlementSchedule,
    });
  }
  upcomingActions.push({
    label: 'Participant onboarding',
    detail: 'Invite participants and collect payout details before any release.',
  });
  upcomingActions.push({
    label: 'Funding required',
    detail: 'No payments execute automatically from agreement approval.',
  });

  return {
    ...base,
    participantCount: participants.length,
    obligationCount: obligations.length,
    participants: participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
      role: participant.role,
    })),
    obligations,
    upcomingActions,
    settlementSchedule,
  };
}
