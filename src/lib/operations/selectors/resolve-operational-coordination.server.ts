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
import type { ObligationOperationalReadiness } from '@/lib/projects/funding-sources/types';
import {
  getOperationalCoordinationSnapshot,
  type OperationalCoordinationInput,
  type OperationalCoordinationSnapshot,
} from '@/lib/operations/selectors/operational-coordination-snapshot';

function pilotStatusToReadiness(status: DealNetworkPilotObligationStatus): ObligationOperationalReadiness {
  switch (status) {
    case DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT:
      return 'ready';
    case DealNetworkPilotObligationStatus.PARTIALLY_FUNDED:
      return 'partially_funded';
    case DealNetworkPilotObligationStatus.UNFUNDED:
      return 'awaiting_funding';
    case DealNetworkPilotObligationStatus.PAID:
      return 'ready';
    default:
      return 'awaiting_funding';
  }
}

function obligationsFromRows(
  rows: Array<{
    id: string;
    participant_id: string | null;
    amount_owed: unknown;
    amount_funded: unknown;
    currency: string | null;
    status: DealNetworkPilotObligationStatus;
  }>
): RawObligationInput[] {
  return rows.map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    amount: Number(row.amount_owed) || 0,
    amountFunded: Number(row.amount_funded) || 0,
    currency: row.currency ?? 'AUD',
    readiness: pilotStatusToReadiness(row.status),
  }));
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
      amount_funded: true,
      currency: true,
      status: true,
    },
  });

  for (const row of obligationRows) {
    const owed = Number(row.amount_owed) || 0;
    const funded = Number(row.amount_funded) || 0;
    obligationsTotal += owed;
    obligationsFunded += funded;
  }

  if (deal) {
    const strait = isStraitProjectDeal(deal);
    const railFunding = strait ? await sumPilotFundingForDeal(deal.id) : 0;
    confirmedFunding = await sumConfirmedFundingForProject(input.userId, deal.id, railFunding);
    fundingAllocated = confirmedFunding > 0;
  }

  const obligations = obligationsFromRows(obligationRows);

  const coordinationInput: OperationalCoordinationInput = {
    participants: dealParticipants,
    obligations,
    projectId: projectId ?? undefined,
    fundingAllocated,
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
