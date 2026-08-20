import 'server-only';

import { prisma } from '@/lib/server/prisma';
import { buildOnboardingProjectWithId } from '@/lib/onboarding/build-onboarding-project';
import { upsertPilotDealForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { REFERRAL_MANAGEMENT_SLUG, referralManagementDealId } from '@/lib/workflows/referral-management/constants';

export async function ensureReferralManagementDeal(input: {
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

  const dealId = referralManagementDealId(input.workflowId);
  const deal = buildOnboardingProjectWithId({
    projectName: 'Referral Management',
    description: 'Promoters and affiliates coordinated from the Referral Management workflow.',
    currency: 'AUD',
    projectId: dealId,
  });
  await upsertPilotDealForUser(input.userId, deal);
  return deal;
}
