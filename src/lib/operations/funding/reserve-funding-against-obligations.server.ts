import 'server-only';

import { DealNetworkPilotObligationStatus } from '@prisma/client';
import type { DemoParticipant } from '@/components/deal-network-demo/invite-participant-modal';
import type { RecentDeal } from '@/lib/data/mock-deal-network';
import { refreshDealNetworkPilotObligationsForDeal } from '@/lib/deal-network-demo/deal-network-pilot-obligations';
import {
  isStraitProjectDeal,
  sumObligationsAmountForDeal,
  sumPilotFundingForDeal,
} from '@/lib/deal-network-demo/pilot-project-funding.server';
import { sumConfirmedFundingForProject } from '@/lib/projects/funding-sources/confirmed-funding.server';
import { deriveFundingCoordinationStage } from '@/lib/operations/truth/funding-coordination-semantics';
import { prisma } from '@/lib/server/prisma';

export type FundingReservationResult = {
  projectId: string;
  confirmedFunding: number;
  obligationsTotal: number;
  obligationsFunded: number;
  fundingReserved: boolean;
  fundingSettled: boolean;
  releaseFunded: boolean;
  obligationsRefreshed: boolean;
};

function obligationsFundedFromRows(
  rows: Array<{ amount_owed: unknown; status: DealNetworkPilotObligationStatus }>
): number {
  let funded = 0;
  for (const row of rows) {
    const owed = Number(row.amount_owed) || 0;
    switch (row.status) {
      case DealNetworkPilotObligationStatus.AVAILABLE_FOR_PAYOUT:
      case DealNetworkPilotObligationStatus.PAID:
      case DealNetworkPilotObligationStatus.PARTIALLY_FUNDED:
        funded += owed;
        break;
      default:
        break;
    }
  }
  return Math.round(funded * 100) / 100;
}

/**
 * Canonical funding allocation — reserves confirmed funding against payout obligations,
 * refreshes obligation rows, and returns coordination coverage for graph recompute.
 */
export async function reserveFundingAgainstObligations(input: {
  userId: string;
  deal: RecentDeal;
  participants: DemoParticipant[];
}): Promise<FundingReservationResult> {
  const { userId, deal, participants } = input;
  const strait = isStraitProjectDeal(deal);
  const railFunding = strait ? await sumPilotFundingForDeal(deal.id) : 0;
  const confirmedFunding = await sumConfirmedFundingForProject(userId, deal.id, railFunding);
  const obligationsTotal = await sumObligationsAmountForDeal(userId, deal.id);

  await refreshDealNetworkPilotObligationsForDeal(userId, deal, participants);

  const obligationRows = await prisma.deal_network_pilot_obligations.findMany({
    where: { user_id: userId, deal_id: deal.id },
    select: { amount_owed: true, status: true },
  });
  const obligationsFunded = obligationsFundedFromRows(obligationRows);

  const stage = deriveFundingCoordinationStage({
    fundingSourceConnected: confirmedFunding > 0 || obligationsTotal > 0,
    confirmedFunding,
    obligationsTotal,
    obligationsFunded,
  });

  return {
    projectId: deal.id,
    confirmedFunding,
    obligationsTotal,
    obligationsFunded,
    fundingReserved: stage.fundingReserved,
    fundingSettled: stage.fundingSettled,
    releaseFunded: stage.releaseFunded,
    obligationsRefreshed: true,
  };
}
