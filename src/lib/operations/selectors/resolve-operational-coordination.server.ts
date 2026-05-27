import 'server-only';

import { DealNetworkPilotObligationStatus } from '@prisma/client';
import { prisma } from '@/lib/server/prisma';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  isStraitProjectDeal,
  sumPilotFundingForDeal,
} from '@/lib/deal-network-demo/pilot-project-funding.server';
import { sumConfirmedFundingForProject } from '@/lib/projects/funding-sources/confirmed-funding.server';
import type { RawObligationInput } from '@/lib/operations/derivations/derive-obligation-state';
import {
  resolveObligationAmountFunded,
  resolveObligationOperationalReadiness,
} from '@/lib/operations/derivations/derive-obligation-allocation-status';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationInput,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';
function obligationsFromRows(
  rows: Array<{
    id: string;
    participant_id: string | null;
    amount_owed: unknown;
    currency: string | null;
    status: DealNetworkPilotObligationStatus;
    payment_event_id?: string | null;
  }>,
  participantsById: Map<string, DemoParticipant>
): RawObligationInput[] {
  return rows.map((row) => {
    const amount = Number(row.amount_owed) || 0;
    const participant = row.participant_id
      ? participantsById.get(row.participant_id)
      : undefined;
    const amountFunded = resolveObligationAmountFunded({
      allocationStatus: row.status,
      amountOwed: amount,
      participant,
      paymentLinked: Boolean(row.payment_event_id),
    });
    const readiness = resolveObligationOperationalReadiness({
      allocationStatus: row.status,
      participant,
      amountOwed: amount,
      amountFunded,
    });
    return {
      id: row.id,
      participantId: row.participant_id,
      amount,
      amountFunded,
      currency: row.currency ?? 'AUD',
      allocationStatus: row.status,
      readiness,
    };
  });
}

export type ResolveOperationalCoordinationInput = {
  userId: string;
  projectId?: string | null;
  participants?: DemoParticipant[];
};

/** Server-side resolver — builds the authoritative operational graph from persisted state. */
export async function resolveOperationalCoordinationSnapshot(
  input: ResolveOperationalCoordinationInput
): Promise<
  OperationalCoordinationSnapshot & {
    projectId: string | null;
    fundingInput: OperationalCoordinationInput['funding'] | null;
  }
> {
  const snapshot = input.participants
    ? { deals: [], participants: input.participants }
    : await getPilotSnapshotForUser(input.userId);

  const projectId =
    input.projectId ?? snapshot.deals[0]?.id ?? null;

  const dealParticipants = projectId
    ? snapshot.participants.filter((p) => !p.dealId || p.dealId === projectId)
    : snapshot.participants;

  const deal = projectId ? snapshot.deals.find((d) => d.id === projectId) : undefined;

  let fundingAllocated = false;
  let confirmedFunding = 0;
  let obligationsTotal = 0;
  let obligationsFunded = 0;

  const obligationWhere = {
    user_id: input.userId,
    ...(projectId ? { deal_id: projectId } : {}),
  };

  const obligationRows = await prisma.deal_network_pilot_obligations.findMany({
    where: obligationWhere,
    select: {
      id: true,
      participant_id: true,
      amount_owed: true,
      currency: true,
      status: true,
      payment_event_id: true,
    },
  });

  const participantsById = new Map(dealParticipants.map((p) => [p.id, p]));

  for (const row of obligationRows) {
    const owed = Number(row.amount_owed) || 0;
    const participant = row.participant_id
      ? participantsById.get(row.participant_id)
      : undefined;
    const funded = resolveObligationAmountFunded({
      allocationStatus: row.status,
      amountOwed: owed,
      participant,
      paymentLinked: Boolean(row.payment_event_id),
    });
    obligationsTotal += owed;
    obligationsFunded += funded;
  }

  const obligations = obligationsFromRows(obligationRows, participantsById);

  if (deal) {
    const strait = isStraitProjectDeal(deal);
    const railFunding = strait ? await sumPilotFundingForDeal(deal.id) : 0;
    confirmedFunding = await sumConfirmedFundingForProject(input.userId, deal.id, railFunding);
    fundingAllocated = confirmedFunding > 0;
  }

  const obligationStatusByParticipant = Object.fromEntries(
    obligations
      .filter((o) => o.participantId && o.allocationStatus)
      .map((o) => [o.participantId as string, o.allocationStatus as string])
  );

  const coordinationInput: OperationalCoordinationInput = {
    participants: dealParticipants,
    obligations,
    projectId: projectId ?? undefined,
    fundingAllocated,
    obligationStatusByParticipant,
    funding: {
      fundingSourceConnected: fundingAllocated || obligationsTotal > 0,
      confirmedFunding,
      obligationsTotal,
      obligationsFunded,
    },
    projectCurrency: deal?.projectValueCurrency ?? 'AUD',
  };

  const graph = getOperationalCoordinationSnapshot(coordinationInput);
  return {
    ...graph,
    projectId,
    fundingInput: coordinationInput.funding ?? null,
  };
}
