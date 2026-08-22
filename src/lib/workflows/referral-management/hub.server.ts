import 'server-only';

import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { listAttributionEarningsForOrganization } from '@/lib/commissions/attribution-earnings.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { deriveAuditTimelineFromParticipants } from '@/lib/operations/audit/derive-audit-timeline-from-state';
import {
  COMMERCIAL_OS_ROUTES,
  settlementEarningsHref,
  settlementObligationsHref,
  settlementOverviewHref,
} from '@/lib/journey/commercial-os-routes';
import {
  buildSettlementObligationRows,
  filterSettlementObligations,
  type PilotObligationApiRow,
  type SettlementPayoutReceipt,
} from '@/lib/settlement/workspace-settlement';
import {
  deriveReferralParticipantSettlementSummary,
  deriveReferralWorkflowSettlementSummary,
} from '@/lib/workflows/referral-management/settlement-summary';
import {
  buildParticipantCoordinationView,
  compensationKindOf,
  workflowParticipantHref,
} from '@/lib/workflows/agreement-intelligence/participant-coordination';
import type {
  WorkflowActivityItem,
  WorkflowOperationalParticipant,
} from '@/lib/workflows/agreement-intelligence/types';
import { isOperationalCoordinationBlocked } from '@/lib/workflows/agreement-intelligence/operational-hub-coordination.server';
import {
  REFERRAL_MANAGEMENT_SLUG,
  referralManagementDealId,
} from '@/lib/workflows/referral-management/constants';
import { ensureReferralManagementDeal } from '@/lib/workflows/referral-management/ensure-program-deal.server';
import { buildReferralAttentionItems } from '@/lib/workflows/referral-management/attention';

function money(amount: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isReferralEligible(participant: DemoParticipant): boolean {
  return compensationKindOf(participant) != null;
}

function mapPromoter(
  participant: DemoParticipant,
  catalogItems: Array<{ id: string; name: string }>
): WorkflowOperationalParticipant {
  const view = buildParticipantCoordinationView(participant, {
    catalogItems,
    operatorApprovalRequired: true,
  });
  const kind = compensationKindOf(participant);
  return {
    id: participant.id,
    name: participant.name,
    commercialRole: participant.companyName || participant.role,
    operationalRole: participant.role,
    partyKind: 'compensated_participant',
    statusLabel:
      view.referralStatus === 'active'
        ? 'Referral operational'
        : view.agreementStatus === 'approved'
          ? 'Approved'
          : 'Needs setup',
    approvalStatus: participant.approvalStatus ?? null,
    onboardingStatus: participant.onboardingStatus ?? null,
    needsAttention:
      view.nextActionKind !== 'none' ||
      view.payoutSetupStatus === 'submitted' ||
      view.payoutSetupStatus === 'flagged',
    attentionReason: view.nextActionLabel,
    manageUrl: workflowParticipantHref(participant.id, REFERRAL_MANAGEMENT_SLUG),
    ...view,
    compensationKind: kind,
  };
}

export async function getReferralManagementContext(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
}) {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
  });
  if (!row || row.template_slug !== REFERRAL_MANAGEMENT_SLUG) {
    return null;
  }

  await ensureReferralManagementDeal(input);

  const snapshot = await getPilotSnapshotForUser(input.userId);
  const catalogItems = await prisma.organization_services.findMany({
    where: { organization_id: input.organizationId, active: true },
    select: { id: true, name: true, description: true, price: true, currency: true },
    orderBy: { name: 'asc' },
  });
  const promoters = snapshot.participants
    .filter(isReferralEligible)
    .map((participant) => mapPromoter(participant, catalogItems));

  const codes = promoters
    .map((row) => row.referral?.code)
    .filter((code): code is string => Boolean(code));
  const attributed = codes.length
    ? await prisma.payment_links.findMany({
        where: {
          organization_id: input.organizationId,
          attribution_referral_code: { in: codes },
          status: { in: ['PAID', 'PAID_UNVERIFIED'] },
        },
        select: {
          amount: true,
          invoice_currency: true,
          attribution_referral_code: true,
          status: true,
        },
        take: 500,
      })
    : [];

  const revenueByCode = new Map<string, { amount: number; conversions: number; currency: string }>();
  let revenueGenerated = 0;
  for (const link of attributed) {
    const amount = Number(link.amount) || 0;
    revenueGenerated += amount;
    const code = link.attribution_referral_code ?? '';
    const current = revenueByCode.get(code) ?? {
      amount: 0,
      conversions: 0,
      currency: link.invoice_currency || 'AUD',
    };
    revenueByCode.set(code, {
      amount: current.amount + amount,
      conversions: current.conversions + 1,
      currency: current.currency,
    });
  }

  const dealId = referralManagementDealId(row.id);
  const promoterIds = [...new Set(promoters.map((row) => row.id).filter(Boolean))];
  const [earnings, pilotObligationRows, payoutRows] = await Promise.all([
    listAttributionEarningsForOrganization(input.organizationId),
    prisma.deal_network_pilot_obligations.findMany({
      where: { user_id: input.userId, deal_id: dealId },
      include: {
        deal: { select: { id: true, name: true, partner: true } },
        participant: {
          select: { id: true, name: true, participant_payload: true },
        },
      },
    }),
    promoterIds.length > 0
      ? prisma.payouts.findMany({
          where: { user_id: { in: promoterIds } },
          select: { user_id: true, status: true },
        })
      : Promise.resolve([]),
  ]);
  const promoterIdSet = new Set(promoterIds);
  const matchingEarnings = earnings.filter((row) => promoterIdSet.has(row.participantId));
  const payoutReceipts: SettlementPayoutReceipt[] = payoutRows.map((row) => ({
    participantId: row.user_id,
    status: row.status,
  }));
  const mappedPilot: PilotObligationApiRow[] = pilotObligationRows.map((obligation) => {
    const payload = obligation.participant?.participant_payload as
      | { approvalStatus?: string; onboardingStatus?: string }
      | null
      | undefined;
    return {
      id: obligation.id,
      deal_id: obligation.deal_id,
      participant_id: obligation.participant_id,
      obligation_type: obligation.obligation_type,
      status: obligation.status,
      amount_owed: Number(obligation.amount_owed),
      currency: obligation.currency,
      deal: obligation.deal,
      participant: obligation.participant
        ? {
            id: obligation.participant.id,
            name: obligation.participant.name,
            approvalStatus: payload?.approvalStatus ?? null,
            onboardingStatus: payload?.onboardingStatus ?? null,
          }
        : null,
    };
  });
  const settlementRows = filterSettlementObligations(
    buildSettlementObligationRows(mappedPilot, matchingEarnings, payoutReceipts),
    { source: 'referral-management' }
  );
  const commissionEarned = matchingEarnings.reduce(
    (sum, row) => sum + row.paidAmount + row.outstandingAmount,
    0
  );
  const pendingPayouts =
    matchingEarnings.filter((row) => row.outstandingAmount > 0).length +
    promoters.filter(
      (row) => row.payoutSetupStatus === 'submitted' || row.payoutSetupStatus === 'flagged'
    ).length;

  const performance = Object.fromEntries(
    promoters.map((promoter) => {
      const code = promoter.referral?.code ?? '';
      const referred = code ? revenueByCode.get(code) : undefined;
      const earned = matchingEarnings.find((row) => row.participantId === promoter.id);
      const paidAmount = earned?.paidAmount ?? 0;
      const outstandingAmount = earned?.outstandingAmount ?? 0;
      return [
        promoter.id ?? '',
        {
          revenueReferred: referred?.amount ?? 0,
          revenueLabel: money(referred?.amount ?? 0, referred?.currency),
          commissionEarned: paidAmount + outstandingAmount,
          commissionLabel: money(paidAmount + outstandingAmount),
          paidAmount,
          outstandingAmount,
          conversions: referred?.conversions ?? 0,
          destinationLabel: promoter.referral?.destinationLabel ?? null,
        },
      ];
    })
  ) as Record<
    string,
    {
      revenueReferred: number;
      revenueLabel: string;
      commissionEarned: number;
      commissionLabel: string;
      paidAmount: number;
      outstandingAmount: number;
      conversions: number;
      destinationLabel: string | null;
    }
  >;

  const needsAttention = buildReferralAttentionItems(promoters);

  const audit = deriveAuditTimelineFromParticipants(snapshot.participants.filter(isReferralEligible));
  const activity: WorkflowActivityItem[] = audit
    .map((entry) => ({
      id: entry.id,
      label: entry.title,
      detail: entry.description,
      timestamp: entry.timestamp,
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 40);

  const paused = isOperationalCoordinationBlocked(row.status === 'PAUSED' ? 'PAUSED' : 'DEPLOYED');

  return {
    workflowId: row.id,
    slug: REFERRAL_MANAGEMENT_SLUG,
    status: row.status,
    lifecycleStatus: row.lifecycle_status,
    paused,
    pauseMessage: paused
      ? 'Referral Management is paused. Historical promoters remain visible; mutations are blocked until you resume.'
      : null,
    metrics: {
      revenueGenerated,
      revenueGeneratedLabel: money(revenueGenerated),
      commissionEarned,
      commissionEarnedLabel: money(commissionEarned),
      activePromoters: promoters.filter((row) => row.referralStatus === 'active').length,
      pendingPayouts,
    },
    promoters,
    performance,
    needsAttention,
    activity,
    catalog: catalogItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: Number(item.price) || 0,
      currency: item.currency,
    })),
    settlement: deriveReferralWorkflowSettlementSummary(settlementRows, commissionEarned),
    participantSettlements: Object.fromEntries(
      promoters.map((promoter) => [
        promoter.id ?? '',
        deriveReferralParticipantSettlementSummary(
          settlementRows.filter((row) => row.participantId === promoter.id),
          performance[promoter.id ?? '']?.commissionEarned ?? 0
        ),
      ])
    ),
    handoff: {
      revenueSharingPreviewUrl: COMMERCIAL_OS_ROUTES.workflowDetail('revenue-sharing'),
      obligationsUrl: settlementObligationsHref({ source: 'referral-management' }),
      commissionsUrl: settlementEarningsHref({ source: 'referral-management' }),
      settlementUrl: settlementOverviewHref({ source: 'referral-management' }),
    },
    agreementIntelligenceInstalled: Boolean(
      await prisma.organization_workflows.findUnique({
        where: {
          ux_organization_workflows_org_template: {
            organization_id: input.organizationId,
            template_slug: 'agreement-intelligence',
          },
        },
        select: { id: true },
      })
    ),
  };
}

export type ReferralManagementContext = NonNullable<
  Awaited<ReturnType<typeof getReferralManagementContext>>
>;
