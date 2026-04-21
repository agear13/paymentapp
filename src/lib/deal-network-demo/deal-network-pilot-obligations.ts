/**
 * Deal Network pilot: explicit commission obligations derived from existing deal + participant rows.
 * Source of truth remains deal_network_pilot_deals / deal_network_pilot_participants (JSON payloads).
 * This module only INSERT/DELETE on deal_network_pilot_obligations — never destructive to pilot source data.
 */
import 'server-only';

import { DealNetworkPilotObligationStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  resolveParticipantCommissionUsd,
  computeParticipantCommissionTotalsForDeal,
  demoParticipantToPilotRow,
  type BaseParticipantSlot,
} from '@/lib/deal-network-demo/commission-structure';
import {
  effectiveParticipantPayoutStatus,
  type ParticipantPayoutSettlementStatus,
} from '@/lib/deal-network-demo/participant-payout-status';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  fundingAnchorPaymentEventIdForDeal,
  isStraitProjectDeal,
  primaryConfirmedFundingEventIdForDeal,
  sumPilotFundingForDeal,
} from '@/lib/deal-network-demo/pilot-project-funding.server';
import { effectiveOnboardingStatus } from '@/lib/deal-network-demo/participant-onboarding';

function payoutLineToObligationStatus(
  payout: ParticipantPayoutSettlementStatus,
  dealStatus: RecentDeal['status']
): DealNetworkPilotObligationStatus {
  if (dealStatus === 'Reversed') return DealNetworkPilotObligationStatus.REVERSED;
  switch (payout) {
    case 'Paid':
      return DealNetworkPilotObligationStatus.PAID;
    case 'Approved':
      return DealNetworkPilotObligationStatus.APPROVED;
    case 'Eligible':
      return DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT;
    case 'Pending':
    default:
      return DealNetworkPilotObligationStatus.PENDING_APPROVAL;
  }
}

/** Platform line follows deal settlement state (same badge as pipeline in pilot UI). */
function dealSettlementToObligationStatus(dealStatus: RecentDeal['status']): DealNetworkPilotObligationStatus {
  switch (dealStatus) {
    case 'Paid':
      return DealNetworkPilotObligationStatus.PAID;
    case 'Approved':
      return DealNetworkPilotObligationStatus.APPROVED;
    case 'Eligible':
      return DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT;
    case 'Reversed':
      return DealNetworkPilotObligationStatus.REVERSED;
    case 'In Review':
      return DealNetworkPilotObligationStatus.PENDING_APPROVAL;
    case 'Pending':
    default:
      return DealNetworkPilotObligationStatus.PENDING_APPROVAL;
  }
}

function roleAmountsFromDeal(deal: RecentDeal): Partial<Record<BaseParticipantSlot, number>> {
  return {
    Introducer: deal.introducerAmount,
    Closer: deal.closerAmount,
    Platform: deal.platformFee,
  };
}

/** Pilot UI / snapshot may show paid state before a payment_events row is linked. */
function dealHasLegacyFundingSnapshot(deal: RecentDeal): boolean {
  if (deal.paymentStatus === 'Paid') return true;
  const s = deal.status;
  return s === 'Paid' || s === 'Approved' || s === 'Eligible' || s === 'Reversed';
}

/**
 * Rebuilds obligation rows for one pilot deal from current DB-backed snapshot fields.
 * Deletes prior obligation rows for this deal_id + user_id only (derived cache), then inserts fresh rows.
 */
export async function refreshDealNetworkPilotObligationsForDeal(
  userId: string,
  deal: RecentDeal,
  participants: DemoParticipant[]
): Promise<void> {
  if (!deal?.id || deal.id === '__placeholder__') return;

  const dealParticipants = participants.filter((p) => p.dealId === deal.id);
  const roleAmounts = roleAmountsFromDeal(deal);
  const currency = 'USD';

  const rows: Prisma.deal_network_pilot_obligationsCreateManyInput[] = [];

  const pilotRows = dealParticipants.map(demoParticipantToPilotRow);
  const joint = computeParticipantCommissionTotalsForDeal(deal.value, roleAmounts, pilotRows);

  const participantLines: Array<{
    p: (typeof dealParticipants)[0];
    payout: ParticipantPayoutSettlementStatus;
    resolved: ReturnType<typeof resolveParticipantCommissionUsd>;
  }> = [];

  for (const p of dealParticipants) {
    const payout = effectiveParticipantPayoutStatus(p, deal);
    const resolved = resolveParticipantCommissionUsd(
      {
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
        baseParticipant: p.baseParticipant,
        commissionBaseParticipantId: p.commissionBaseParticipantId,
        formulaExpression: p.formulaExpression,
      },
      deal.value,
      roleAmounts,
      {
        participantTotals: joint.totals,
        participantLabels: joint.labels,
        resolvingParticipantId: p.id,
      }
    );
    if (resolved.total <= 0) continue;
    participantLines.push({ p, payout, resolved });
  }

  let totalOwed = participantLines.reduce((s, x) => s + x.resolved.total, 0);
  if (typeof deal.platformFee === 'number' && deal.platformFee > 0) {
    totalOwed += deal.platformFee;
  }

  const fundingConfirmedEvtId = await primaryConfirmedFundingEventIdForDeal(deal.id);
  const legacyMoney = Boolean(fundingConfirmedEvtId) || dealHasLegacyFundingSnapshot(deal);
  const strait = isStraitProjectDeal(deal);
  const fundedAmount = strait ? await sumPilotFundingForDeal(deal.id) : 0;
  const straitFullyFunded =
    strait && totalOwed > 0 && fundedAmount + 0.005 >= totalOwed;
  const straitPartial =
    strait &&
    totalOwed > 0 &&
    fundedAmount > 0 &&
    fundedAmount + 0.005 < totalOwed &&
    !legacyMoney;

  const moneyConfirmed = strait ? legacyMoney || straitFullyFunded : legacyMoney;

  const anchorEventId = moneyConfirmed
    ? fundingConfirmedEvtId ?? (await fundingAnchorPaymentEventIdForDeal(deal.id))
    : null;

  const unfundedRowStatus = straitPartial
    ? DealNetworkPilotObligationStatus.PARTIALLY_FUNDED
    : DealNetworkPilotObligationStatus.UNFUNDED;

  for (const { p, payout, resolved } of participantLines) {
    const snapshot = {
      dealId: deal.id,
      dealName: deal.dealName,
      dealStatus: deal.status,
      dealValue: deal.value,
      participant: {
        id: p.id,
        name: p.name,
        role: p.role,
        commissionKind: p.commissionKind,
        commissionValue: p.commissionValue,
        baseParticipant: p.baseParticipant ?? null,
        commissionBaseParticipantId: p.commissionBaseParticipantId ?? null,
        formulaExpression: p.formulaExpression ?? null,
        approvalStatus: p.approvalStatus,
        onboardingStatus: effectiveOnboardingStatus(p),
        payoutSettlementStatus: p.payoutSettlementStatus ?? null,
      },
      previewLine: resolved.previewLine,
      computedAt: new Date().toISOString(),
    };

    rows.push({
      user_id: userId,
      organization_id: null,
      deal_id: deal.id,
      participant_id: p.id,
      allocation_rule_id: null,
      payment_event_id: moneyConfirmed ? anchorEventId : null,
      obligation_type: 'PARTICIPANT',
      amount_owed: new Prisma.Decimal(resolved.total.toFixed(2)),
      currency,
      status: moneyConfirmed
        ? payoutLineToObligationStatus(payout, deal.status)
        : unfundedRowStatus,
      calculation_explanation: resolved.previewLine,
      calculation_snapshot_json: snapshot as unknown as Prisma.InputJsonValue,
      due_date: null,
    });
  }

  if (typeof deal.platformFee === 'number' && deal.platformFee > 0) {
    rows.push({
      user_id: userId,
      organization_id: null,
      deal_id: deal.id,
      participant_id: null,
      allocation_rule_id: null,
      payment_event_id: moneyConfirmed ? anchorEventId : null,
      obligation_type: 'PLATFORM_FEE',
      amount_owed: new Prisma.Decimal(deal.platformFee.toFixed(2)),
      currency,
      status: moneyConfirmed
        ? dealSettlementToObligationStatus(deal.status)
        : unfundedRowStatus,
      calculation_explanation: `Platform fee from deal record: $${deal.platformFee.toLocaleString()}`,
      calculation_snapshot_json: {
        dealId: deal.id,
        platformFee: deal.platformFee,
        dealStatus: deal.status,
        computedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
      due_date: null,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.deal_network_pilot_obligations.deleteMany({
      where: { user_id: userId, deal_id: deal.id },
    });
    if (rows.length > 0) {
      await tx.deal_network_pilot_obligations.createMany({ data: rows });
    }
  });
}

/** Rebuild obligations for all deals in the user’s current pilot snapshot (read-only on source tables). */
export async function refreshDealNetworkPilotObligationsForUser(userId: string): Promise<void> {
  const { deals, participants } = await getPilotSnapshotForUser(userId);
  for (const deal of deals) {
    // Sequential per deal keeps transaction scope small; avoids long locks.
    await refreshDealNetworkPilotObligationsForDeal(userId, deal, participants);
  }
}
