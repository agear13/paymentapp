import 'server-only';

import {
  dealRowToRecentDeal,
  persistPilotDealForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { prisma } from '@/lib/server/prisma';
import {
  applyProjectDetailsPatch,
  type ProjectDetailsPatch,
} from '@/lib/projects/update-project-details';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

export class ProjectDetailsError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = 'ProjectDetailsError';
  }
}

export async function updateProjectDetailsForUser(input: {
  userId: string;
  dealId: string;
  patch: ProjectDetailsPatch;
}): Promise<RecentDeal> {
  const row = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: input.dealId, user_id: input.userId },
    select: { id: true, deal_payload: true },
  });
  if (!row) {
    throw new ProjectDetailsError('Project not found', 'NOT_FOUND', 404);
  }

  try {
    const next = applyProjectDetailsPatch(dealRowToRecentDeal(row), input.patch);
    return persistPilotDealForUser(input.userId, next);
  } catch (error) {
    throw new ProjectDetailsError(
      error instanceof Error ? error.message : 'Could not update project details.',
      'INVALID_INPUT',
      400
    );
  }
}
