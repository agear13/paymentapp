import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { buildOnboardingProjectWithId } from '@/lib/onboarding/build-onboarding-project';
import {
  dealRowToRecentDeal,
  upsertPilotDealForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { REFERRAL_MANAGEMENT_SLUG, referralManagementDealId } from '@/lib/workflows/referral-management/constants';
import { updateProjectDetailsForUser } from '@/lib/projects/update-project-details.server';
import type { ProjectDetailsPatch } from '@/lib/projects/update-project-details';
import type { RecentDeal } from '@/lib/data/mock-deal-network';

export async function ensureReferralManagementDeal(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
}): Promise<RecentDeal | null> {
  const row = await prisma.organization_workflows.findFirst({
    where: { id: input.workflowId, organization_id: input.organizationId },
  });
  if (!row || row.template_slug !== REFERRAL_MANAGEMENT_SLUG) {
    return null;
  }

  const dealId = referralManagementDealId(input.workflowId);
  const existing = await prisma.deal_network_pilot_deals.findFirst({
    where: { id: dealId },
    select: { id: true, deal_payload: true },
  });
  if (existing) {
    return dealRowToRecentDeal(existing);
  }

  const deal = buildOnboardingProjectWithId({
    projectName: 'Referral Management',
    description: 'Promoters and affiliates coordinated from the Referral Management workflow.',
    currency: 'AUD',
    projectId: dealId,
  });
  await upsertPilotDealForUser(input.userId, deal);
  return deal;
}

export async function updateReferralManagementProgram(input: {
  organizationId: string;
  workflowId: string;
  userId: string;
  patch: ProjectDetailsPatch;
}): Promise<RecentDeal | null> {
  const deal = await ensureReferralManagementDeal(input);
  if (!deal) return null;
  return updateProjectDetailsForUser({
    userId: input.userId,
    dealId: deal.id,
    patch: input.patch,
  });
}
