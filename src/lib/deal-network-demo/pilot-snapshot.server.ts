/**
 * Server-only persistence for Rabbit Hole Deal Network pilot (Postgres via Prisma).
 * Tied to Supabase auth user id (same UUID string as auth.users.id).
 */
import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';

export interface PilotSnapshotPayload {
  deals: RecentDeal[];
  participants: DemoParticipant[];
}

export function dealRowToRecentDeal(row: {
  id: string;
  deal_payload: Prisma.JsonValue;
}): RecentDeal {
  const payload = row.deal_payload as unknown as RecentDeal;
  return { ...payload, id: row.id };
}

export function participantRowToDemo(row: {
  id: string;
  deal_id: string;
  invite_token: string;
  participant_payload: Prisma.JsonValue;
}): DemoParticipant {
  const payload = row.participant_payload as unknown as DemoParticipant;
  return {
    ...payload,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
  };
}

function dealToPrismaData(deal: RecentDeal, userId: string) {
  return {
    user_id: userId,
    name: deal.dealName,
    partner: deal.partner,
    contact: deal.rhContactLine ?? null,
    deal_value: new Prisma.Decimal(deal.value),
    payment_link: deal.paymentLink ?? null,
    payment_status: deal.paymentStatus,
    paid_amount:
      deal.paidAmount != null && Number.isFinite(deal.paidAmount)
        ? new Prisma.Decimal(deal.paidAmount)
        : null,
    paid_at: deal.paidAt ? new Date(deal.paidAt) : null,
    deal_payload: deal as unknown as Prisma.InputJsonValue,
  };
}

function participantToPrismaData(p: DemoParticipant) {
  if (!p.dealId) {
    throw new Error('Participant missing dealId');
  }
  return {
    deal_id: p.dealId,
    invite_token: p.inviteToken,
    name: p.name,
    email: p.email?.trim() ? p.email : null,
    role: p.role,
    role_details: p.roleDetails ?? null,
    payout_condition: p.payoutCondition ?? null,
    approval_status: p.approvalStatus,
    approved_at: p.approvedAt ? new Date(p.approvedAt) : null,
    participant_payload: p as unknown as Prisma.InputJsonValue,
  };
}

export async function getPilotSnapshotForUser(userId: string): Promise<PilotSnapshotPayload> {
  const deals = await prisma.deal_network_pilot_deals.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
  const dealIds = deals.map((d) => d.id);
  if (dealIds.length === 0) {
    return { deals: [], participants: [] };
  }
  const participants = await prisma.deal_network_pilot_participants.findMany({
    where: { deal_id: { in: dealIds } },
  });
  return {
    deals: deals.map(dealRowToRecentDeal),
    participants: participants.map(participantRowToDemo),
  };
}

export async function syncPilotSnapshotForUser(
  userId: string,
  deals: RecentDeal[],
  participants: DemoParticipant[]
): Promise<void> {
  const incomingDealIds = new Set(deals.map((d) => d.id));

  await prisma.$transaction(async (tx) => {
    const existingDeals = await tx.deal_network_pilot_deals.findMany({
      where: { user_id: userId },
      select: { id: true },
    });
    for (const e of existingDeals) {
      if (!incomingDealIds.has(e.id)) {
        await tx.deal_network_pilot_deals.delete({ where: { id: e.id } });
      }
    }

    for (const deal of deals) {
      const data = dealToPrismaData(deal, userId);
      await tx.deal_network_pilot_deals.upsert({
        where: { id: deal.id },
        create: { id: deal.id, ...data },
        update: data,
      });
    }

    const ownedDealIds = new Set(deals.map((d) => d.id));
    const relevantParticipants = participants.filter(
      (p) => p.dealId && ownedDealIds.has(p.dealId)
    );
    const incomingPartIds = new Set(relevantParticipants.map((p) => p.id));

    const existingParts = await tx.deal_network_pilot_participants.findMany({
      where: { deal: { user_id: userId } },
      select: { id: true },
    });
    for (const ep of existingParts) {
      if (!incomingPartIds.has(ep.id)) {
        await tx.deal_network_pilot_participants.delete({ where: { id: ep.id } });
      }
    }

    for (const p of relevantParticipants) {
      const data = participantToPrismaData(p);
      await tx.deal_network_pilot_participants.upsert({
        where: { id: p.id },
        create: { id: p.id, ...data },
        update: data,
      });
    }
  });
}

export async function getParticipantByInviteToken(token: string) {
  return prisma.deal_network_pilot_participants.findUnique({
    where: { invite_token: token },
    include: { deal: true },
  });
}

/** All pilot participant rows for a deal (for joint commission resolution on invite / obligations). */
export async function getPilotParticipantsForDeal(dealId: string): Promise<DemoParticipant[]> {
  const rows = await prisma.deal_network_pilot_participants.findMany({
    where: { deal_id: dealId },
  });
  return rows.map(participantRowToDemo);
}

export async function markParticipantInviteOpened(token: string): Promise<void> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { invite_token: token },
  });
  if (!row) return;
  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = { ...cur, inviteStatus: 'Opened' };
  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: {
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function approveParticipantByInviteToken(
  token: string,
  note: string | undefined
): Promise<{ deal: RecentDeal; participant: DemoParticipant } | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { invite_token: token },
    include: { deal: true },
  });
  if (!row) return null;

  const now = new Date().toISOString();
  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = {
    ...cur,
    status: 'Confirmed',
    inviteStatus: 'Opened',
    approvalStatus: 'Approved',
    approvedAt: now,
    approvalNote: note?.trim() || undefined,
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: {
      approval_status: 'Approved',
      approved_at: new Date(now),
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    deal: dealRowToRecentDeal(row.deal),
    participant: {
      ...next,
      id: row.id,
      dealId: row.deal_id,
      inviteToken: row.invite_token,
    },
  };
}
