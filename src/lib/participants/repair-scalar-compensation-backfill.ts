import { Prisma } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import {
  needsScalarRevenueShareProfileRepair,
  repairScalarCompensationProfile,
} from '@/lib/participants/repair-scalar-compensation-profile';

type ScalarCompensationParticipantRow = {
  id: string;
  deal_id: string;
  invite_token: string;
  participant_payload: Prisma.JsonValue;
};

export type ScalarCompensationBackfillPrisma = {
  deal_network_pilot_participants: {
    findMany: (args: {
      select: {
        id: true;
        deal_id: true;
        invite_token: true;
        participant_payload: true;
      };
    }) => Promise<ScalarCompensationParticipantRow[]>;
    update: (args: {
      where: { id: string };
      data: { participant_payload: Prisma.InputJsonValue };
    }) => Promise<unknown>;
  };
};

export type ScalarCompensationBackfillGroup =
  | 'revenue_share'
  | 'pct_deal_value_without_revenue_share';

export type ScalarCompensationBackfillCandidate = {
  participantId: string;
  dealId: string;
  group: ScalarCompensationBackfillGroup;
};

export type ScalarCompensationBackfillResult = {
  totalCandidates: number;
  wouldChange: number;
  changed: number;
  revenueShareCount: number;
  pctDealValueWithoutRevenueShareCount: number;
  candidates: ScalarCompensationBackfillCandidate[];
};

export function classifyScalarCompensationBackfillCandidate(
  participant: DemoParticipant
): ScalarCompensationBackfillGroup | null {
  if (!needsScalarRevenueShareProfileRepair(participant)) return null;
  if (participant.participationModel === 'revenue_share') return 'revenue_share';
  return 'pct_deal_value_without_revenue_share';
}

function participantFromRow(row: {
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

/**
 * Explicit, idempotent compensation-profile backfill.
 * Dry-run by default (`execute: false`). Does not run on deploy.
 */
export async function runScalarCompensationProfileBackfill(options: {
  prisma: ScalarCompensationBackfillPrisma;
  execute?: boolean;
}): Promise<ScalarCompensationBackfillResult> {
  const execute = options.execute === true;
  const { prisma } = options;
  const rows = await prisma.deal_network_pilot_participants.findMany({
    select: {
      id: true,
      deal_id: true,
      invite_token: true,
      participant_payload: true,
    },
  });

  const candidates: ScalarCompensationBackfillCandidate[] = [];
  const repairs: Array<{ id: string; payload: DemoParticipant }> = [];

  for (const row of rows) {
    const current = participantFromRow(row);
    const group = classifyScalarCompensationBackfillCandidate(current);
    if (!group) continue;

    const { participant: repairedParticipant, repaired } =
      repairScalarCompensationProfile(current);
    if (!repaired) continue;

    candidates.push({
      participantId: row.id,
      dealId: row.deal_id,
      group,
    });
    repairs.push({
      id: row.id,
      payload: {
        ...repairedParticipant,
        id: row.id,
        dealId: row.deal_id,
        inviteToken: row.invite_token,
      },
    });
  }

  let changed = 0;
  if (execute) {
    for (const repair of repairs) {
      await prisma.deal_network_pilot_participants.update({
        where: { id: repair.id },
        data: {
          participant_payload: repair.payload as unknown as Prisma.InputJsonValue,
        },
      });
      changed += 1;
    }
  }

  return {
    totalCandidates: candidates.length,
    wouldChange: candidates.length,
    changed,
    revenueShareCount: candidates.filter((c) => c.group === 'revenue_share').length,
    pctDealValueWithoutRevenueShareCount: candidates.filter(
      (c) => c.group === 'pct_deal_value_without_revenue_share'
    ).length,
    candidates,
  };
}
