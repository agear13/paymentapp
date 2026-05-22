import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import {
  deriveWorkspaceActivation,
  merchantRowToRailFlags,
} from '@/lib/onboarding/workspace-activation-state';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';

/** GET /api/workspace/activation — derived activation snapshot for onboarding orchestration */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const org = await getOrganizationForAuthenticatedUser(user.id);
  if (!org) {
    const empty = deriveWorkspaceActivation({
      hasOrganization: false,
      onboardingCompleted: false,
      projectCreated: false,
      participantCount: 0,
      obligationCount: 0,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: true,
      defaultCurrency: null,
      stripeConfigured: false,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: 0,
      releaseBatchCount: 0,
    });
    return apiResponse({
      activation: empty,
      nextAction: deriveNextRecommendedAction(empty),
    });
  }

  const [
    merchant,
    onboardingState,
    snapshot,
    obligationCount,
    paymentLinkCount,
    releaseEligibleCount,
    releaseBatchCount,
  ] = await Promise.all([
    prisma.merchant_settings.findFirst({
      where: { organization_id: org.id },
      select: {
        default_currency: true,
        stripe_account_id: true,
        hedera_account_id: true,
        wise_enabled: true,
        wise_profile_id: true,
      },
    }),
    getOperatorOnboardingState(org.id),
    getPilotSnapshotForUser(user.id).catch(() => ({ deals: [], participants: [] })),
    prisma.deal_network_pilot_obligations
      .count({ where: { organization_id: org.id } })
      .catch(() => 0),
    prisma.payment_links.count({ where: { organization_id: org.id } }).catch(() => 0),
    prisma.deal_network_pilot_obligations
      .count({ where: { organization_id: org.id, status: 'AVAILABLE_FOR_PAYOUT' } })
      .catch(() => 0),
    prisma.payout_batches.count({ where: { organization_id: org.id } }).catch(() => 0),
  ]);

  const rails = merchantRowToRailFlags(merchant);
  const projectCreated = snapshot.deals.length > 0 || Boolean(onboardingState?.projectId);

  const activation = deriveWorkspaceActivation({
    hasOrganization: true,
    onboardingCompleted: onboardingState?.completed === true,
    projectCreated,
    participantCount: snapshot.participants.length,
    obligationCount,
    paymentLinkCount,
    collectionPreferenceDecideLater:
      onboardingState?.collection_preference === 'decide_later' ||
      onboardingState?.collection_preference == null,
    defaultCurrency: merchant?.default_currency ?? null,
    ...rails,
    releaseEligibleCount,
    releaseBatchCount,
  });

  return apiResponse({
    activation,
    nextAction: deriveNextRecommendedAction(activation),
  });
}
