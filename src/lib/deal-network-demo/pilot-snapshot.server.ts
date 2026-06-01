/**
 * Server-only persistence for Rabbit Hole Deal Network pilot (Postgres via Prisma).
 * Tied to Supabase auth user id (same UUID string as auth.users.id).
 */
import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  ensureReferralIssuance,
  ReferralIssuanceError,
  resolveOrganizationIdForPilotDeal,
} from '@/lib/referrals/ensure-referral-issuance';
import {
  defaultReferralCommerce,
  normalizeReferralCommerce,
  shouldIssueReferralLink,
  type ParticipantReferralCommerce,
} from '@/lib/referrals/referral-commerce-config';
import { deriveReferralCommerceFromCompensationProfile } from '@/lib/referrals/derive-referral-commerce-from-profile';
import { isProjectWorkspaceParticipant } from '@/lib/projects/participant-entitlement';
import { canParticipantApproveAgreement } from '@/lib/operations/contracts/canonical-agreement-lifecycle';
import { referralTrace } from '@/lib/referrals/referral-trace';
import {
  shouldIssueAttributionForParticipant,
} from '@/lib/operations/truth/attribution-truth';
import {
  isAllActiveCatalogSource,
  type CatalogItemRef,
} from '@/lib/operations/derivations/commission-scope';

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

import { normalizeParticipant } from '@/lib/operational/safe-operational-hydration';
import { repairScalarCompensationProfile } from '@/lib/participants/repair-scalar-compensation-profile';

export function participantRowToDemo(row: {
  id: string;
  deal_id: string;
  invite_token: string;
  participant_payload: Prisma.JsonValue;
  approval_status?: string;
  approved_at?: Date | null;
}): DemoParticipant {
  const payload = row.participant_payload as unknown as DemoParticipant;
  const approvalStatus: DemoParticipant['approvalStatus'] =
    row.approval_status === 'Approved' || payload.approvalStatus === 'Approved'
      ? 'Approved'
      : 'Pending approval';
  return normalizeParticipant({
    ...payload,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
    approvalStatus,
    approvedAt: row.approved_at
      ? row.approved_at.toISOString()
      : payload.approvedAt,
    inviteStatus:
      approvalStatus === 'Approved'
        ? payload.inviteStatus === 'Opened'
          ? 'Opened'
          : payload.inviteStatus ?? 'Invited'
        : payload.inviteStatus ?? 'Invited',
  });
}

export type ReferralIssuanceSummary = {
  code: string;
  referralUrl: string;
  created: boolean;
};

function resolveReferralCommerceForIssuance(
  participant: DemoParticipant
): ParticipantReferralCommerce | null {
  if (participant.referralCommerce) {
    return normalizeReferralCommerce(participant.referralCommerce);
  }
  const fromProfile = deriveReferralCommerceFromCompensationProfile(participant);
  if (fromProfile) {
    return fromProfile;
  }
  if (!isProjectWorkspaceParticipant(participant)) {
    return null;
  }
  const base = defaultReferralCommerce();
  const commissionMode =
    participant.participationModel === 'customer_attribution'
      ? 'referral_commerce'
      : base.commissionMode;
  return normalizeReferralCommerce({ ...base, commissionMode });
}

async function resolveAttributionCatalogContext(
  participant: DemoParticipant,
  organizationId: string
): Promise<CatalogItemRef[]> {
  const profileIds = participant.compensationProfile?.commissionServiceIds ?? [];
  const commerceIds = participant.referralCommerce?.enabledServiceIds ?? [];
  const selectedIds = profileIds.length > 0 ? profileIds : commerceIds;

  if (selectedIds.length > 0) {
    const services = await prisma.organization_services.findMany({
      where: { id: { in: selectedIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(services.map((s) => [s.id, s.name] as const));
    return selectedIds.map((id) => ({ id, name: nameById.get(id) ?? id }));
  }

  if (!isAllActiveCatalogSource(participant)) {
    return [];
  }

  const services = await prisma.organization_services.findMany({
    where: { organization_id: organizationId, active: true },
    select: { id: true, name: true },
  });
  return services.map((s) => ({ id: s.id, name: s.name ?? s.id }));
}

/** Issue (or reuse) customer commerce + persist on participant row. */
export async function issueAndPersistParticipantAttribution(input: {
  row: {
    id: string;
    deal_id: string;
    invite_token: string;
    participant_payload: Prisma.JsonValue;
    deal: { user_id: string; id: string; deal_payload: Prisma.JsonValue };
  };
  participant: DemoParticipant;
  approverUserId?: string | null;
}): Promise<{ participant: DemoParticipant; referralIssuance?: ReferralIssuanceSummary }> {
  const { row, participant } = input;
  const deal = dealRowToRecentDeal(row.deal);
  const referralCommerce = resolveReferralCommerceForIssuance(participant);
  const participantForGate: DemoParticipant = {
    ...participant,
    referralCommerce: referralCommerce ?? participant.referralCommerce,
  };

  log.info('referral issuance started', {
    pilotParticipantId: row.id,
    dealId: row.deal_id,
    operatorUserId: row.deal.user_id,
  });

  const organizationId = await resolveOrganizationIdForPilotDeal(row.deal.user_id, row.deal_id);
  if (!organizationId) {
    throw new ReferralIssuanceError(
      'Merchant organization not found for this project',
      'ORGANIZATION_NOT_FOUND',
      { pilotParticipantId: row.id, dealId: row.deal_id, operatorUserId: row.deal.user_id }
    );
  }

  const catalogItems = await resolveAttributionCatalogContext(participantForGate, organizationId);
  if (!shouldIssueAttributionForParticipant(participantForGate, { catalogItems })) {
    log.info('referral issuance skipped: attribution not eligible', {
      pilotParticipantId: row.id,
      dealId: row.deal_id,
      catalogItemCount: catalogItems.length,
    });
    return { participant };
  }

  let issued;
  try {
    issued = await ensureReferralIssuance({
      organizationId,
      operatorUserId: row.deal.user_id,
      participantUserId: null,
      participantEmail: participant.email,
      participantName: participant.name,
      sourceParticipantId: row.id,
      referralCodeHint: participant.referralCode ?? null,
      commissionKind: participant.commissionKind,
      commissionValue: participant.commissionValue,
      projectLabel: deal.dealName,
      referralCommerce,
    });
  } catch (err) {
    log.error(
      'referral generation failed',
      err instanceof Error ? err : undefined,
      { pilotParticipantId: row.id, dealId: row.deal_id, organizationId }
    );
    throw new ReferralIssuanceError(
      'Referral link generation failed',
      'REFERRAL_GENERATION_FAILED',
      {
        pilotParticipantId: row.id,
        dealId: row.deal_id,
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  }

  log.info('referral code generated', {
    pilotParticipantId: row.id,
    referralCode: issued.code,
    referralUrl: issued.referralUrl,
    created: issued.created,
  });

  const referralIssuance: ReferralIssuanceSummary = {
    code: issued.code,
    referralUrl: issued.referralUrl,
    created: issued.created,
  };

  const payloadWithLink: DemoParticipant = {
    ...participant,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
    referralCode: issued.code,
    inviteLink: issued.referralUrl,
    customerCommerceUrl: issued.referralUrl,
    attributionStatus: 'active',
    referralCommerce: referralCommerce ?? participant.referralCommerce,
  };

  try {
    await prisma.deal_network_pilot_participants.update({
      where: { id: row.id },
      data: {
        participant_payload: payloadWithLink as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    log.error(
      'referral persistence failed',
      err instanceof Error ? err : undefined,
      { pilotParticipantId: row.id, referralCode: issued.code }
    );
    throw new ReferralIssuanceError(
      'Failed to persist customer commerce link on participant',
      'PERSISTENCE_FAILED',
      {
        pilotParticipantId: row.id,
        cause: err instanceof Error ? err.message : String(err),
      }
    );
  }

  log.info('customer commerce url persisted', {
    pilotParticipantId: row.id,
    customerCommerceUrl: issued.referralUrl,
  });

  if (
    process.env.NODE_ENV === 'development' &&
    participant.approvalStatus === 'Approved' &&
    !payloadWithLink.customerCommerceUrl?.trim()
  ) {
    log.warn('DEV: participant approved but customer commerce url missing after issuance', {
      pilotParticipantId: row.id,
    });
  }

  return { participant: payloadWithLink, referralIssuance };
}

export async function updatePilotParticipantPayload(
  participantId: string,
  operatorUserId: string,
  patch: Partial<DemoParticipant>
): Promise<DemoParticipant | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { id: participantId },
    include: { deal: true },
  });
  if (!row || row.deal.user_id !== operatorUserId) return null;

  const cur = row.participant_payload as unknown as DemoParticipant;
  const next: DemoParticipant = {
    ...cur,
    ...patch,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
  };

  await prisma.deal_network_pilot_participants.update({
    where: { id: row.id },
    data: {
      approval_status:
        next.approvalStatus === 'Approved' ? 'Approved' : row.approval_status,
      approved_at:
        next.approvalStatus === 'Approved'
          ? next.approvedAt
            ? new Date(next.approvedAt)
            : row.approved_at ?? new Date()
          : row.approved_at,
      participant_payload: next as unknown as Prisma.InputJsonValue,
    },
  });

  return participantRowToDemo({
    ...row,
    approval_status: next.approvalStatus === 'Approved' ? 'Approved' : row.approval_status,
    approved_at:
      next.approvalStatus === 'Approved'
        ? next.approvedAt
          ? new Date(next.approvedAt)
          : row.approved_at
        : row.approved_at,
    participant_payload: next as unknown as Prisma.JsonValue,
  });
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
  const participantRows = await prisma.deal_network_pilot_participants.findMany({
    where: { deal_id: { in: dealIds } },
  });

  const participants = await Promise.all(
    participantRows.map(async (row) => {
      const payload = row.participant_payload as unknown as DemoParticipant;
      const { participant: repaired, repaired: didRepair } = repairScalarCompensationProfile({
        ...payload,
        id: row.id,
        dealId: row.deal_id,
        inviteToken: row.invite_token,
      });
      if (didRepair) {
        await prisma.deal_network_pilot_participants.update({
          where: { id: row.id },
          data: {
            participant_payload: {
              ...repaired,
              id: row.id,
              dealId: row.deal_id,
              inviteToken: row.invite_token,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return participantRowToDemo({
        ...row,
        participant_payload: repaired as unknown as Prisma.JsonValue,
      });
    })
  );

  return {
    deals: deals.map(dealRowToRecentDeal),
    participants,
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

export type ApproveParticipantResult = {
  deal: RecentDeal;
  participant: DemoParticipant;
  referralIssuance?: {
    code: string;
    referralUrl: string;
    created: boolean;
  };
};

export async function approveParticipantByInviteToken(
  token: string,
  note: string | undefined,
  options?: { approverUserId?: string | null }
): Promise<ApproveParticipantResult | null> {
  const row = await prisma.deal_network_pilot_participants.findUnique({
    where: { invite_token: token },
    include: { deal: true },
  });
  if (!row) return null;

  const cur = row.participant_payload as unknown as DemoParticipant;
  if (!canParticipantApproveAgreement(cur)) {
    throw new Error('AGREEMENT_NOT_APPROVABLE');
  }

  const now = new Date().toISOString();
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

  const deal = dealRowToRecentDeal(row.deal);
  const participant: DemoParticipant = {
    ...next,
    id: row.id,
    dealId: row.deal_id,
    inviteToken: row.invite_token,
  };

  log.info('participant approval persisted', {
    inviteToken: token,
    pilotParticipantId: row.id,
    dealId: row.deal_id,
  });

  referralTrace('approveParticipant.start', {
    inviteToken: token,
    pilotParticipantId: row.id,
    dealId: row.deal_id,
    operatorUserId: row.deal.user_id,
    approverUserId: options?.approverUserId ?? null,
    participantEmail: participant.email?.trim() || null,
    approvalStatus: 'Approved',
  });

  try {
    const activated = await issueAndPersistParticipantAttribution({
      row,
      participant,
    });
    log.info('approve participant response ready', {
      pilotParticipantId: row.id,
      hasReferralIssuance: !!activated.referralIssuance,
      customerCommerceUrl: activated.participant.customerCommerceUrl ?? null,
    });
    return {
      deal,
      participant: activated.participant,
      referralIssuance: activated.referralIssuance,
    };
  } catch (err) {
    log.error(
      'Referral issuance failed after approval. Rolling back approval.',
      err instanceof Error ? err : undefined,
      {
        pilotParticipantId: row.id,
        error: err instanceof Error ? err.message : String(err),
      }
    );
    await prisma.deal_network_pilot_participants.update({
      where: { id: row.id },
      data: {
        approval_status: row.approval_status,
        approved_at: row.approved_at,
        participant_payload: cur as unknown as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}
