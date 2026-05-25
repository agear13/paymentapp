import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { merchantRowToRailFlags } from '@/lib/onboarding/workspace-activation-state';
import { evaluateWorkspaceCompensationReadiness } from '@/lib/participants/participant-compensation';
import { safeDeriveActivationResponse } from '@/lib/onboarding/workspace-activation-fallback';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { activationFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';

/** GET /api/workspace/activation — derived activation snapshot from canonical operational graph */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const org = await getOrganizationForAuthenticatedUser(user.id);
    if (!org) {
      const { activation, nextAction } = safeDeriveActivationResponse({
        hasOrganization: false,
        onboardingCompleted: false,
        projectCreated: false,
        participantCount: 0,
        participantsConfigured: false,
        participantsConfiguredCount: 0,
        obligationCount: 0,
        paymentLinkCount: 0,
        collectionPreferenceDecideLater: true,
        defaultCurrency: null,
        stripeConfigured: false,
        wiseConfigured: false,
        hederaConfigured: false,
        releaseEligibleCount: 0,
        releaseBatchCount: 0,
        primaryProjectId: null,
      });
      return apiResponse({ activation, nextAction });
    }

    const [
      merchant,
      onboardingState,
      snapshot,
      paymentLinkCount,
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
      prisma.payment_links.count({ where: { organization_id: org.id } }).catch(() => 0),
      prisma.payout_batches.count({ where: { organization_id: org.id } }).catch(() => 0),
    ]);

    const rails = merchantRowToRailFlags(merchant);
    const projectCreated = snapshot.deals.length > 0 || Boolean(onboardingState?.projectId);
    const compensation = evaluateWorkspaceCompensationReadiness(snapshot.participants);
    const primaryProjectId =
      onboardingState?.projectId ?? snapshot.deals[0]?.id ?? null;

    const graph = await resolveOperationalCoordinationSnapshot({
      userId: user.id,
      projectId: primaryProjectId,
      participants: snapshot.participants,
    });

    const activationInput = {
      hasOrganization: true,
      onboardingCompleted: onboardingState?.completed === true,
      projectCreated,
      participantCount: compensation.participantCount,
      participantsConfigured: compensation.participantsConfigured,
      participantsConfiguredCount: compensation.configuredCount,
      obligationCount: graph.obligations.length,
      paymentLinkCount,
      collectionPreferenceDecideLater:
        onboardingState?.collection_preference === 'decide_later' ||
        onboardingState?.collection_preference == null,
      defaultCurrency: merchant?.default_currency ?? null,
      ...rails,
      releaseEligibleCount: graph.summary.releaseReadyCount,
      releaseBatchCount,
      primaryProjectId,
    };

    const activation = activationFromOperationalGraph(graph, activationInput);
    const nextAction = deriveNextRecommendedAction(activation);

    return apiResponse({ activation, nextAction, operationalGraph: { summary: graph.summary, funding: graph.funding } });
  } catch (e) {
    console.error('[workspace/activation GET]', e);
    const { activation, nextAction } = safeDeriveActivationResponse({
      hasOrganization: true,
      onboardingCompleted: false,
      projectCreated: true,
      participantCount: 1,
      participantsConfigured: false,
      participantsConfiguredCount: 0,
      obligationCount: 0,
      paymentLinkCount: 0,
      collectionPreferenceDecideLater: true,
      defaultCurrency: null,
      stripeConfigured: false,
      wiseConfigured: false,
      hederaConfigured: false,
      releaseEligibleCount: 0,
      releaseBatchCount: 0,
      primaryProjectId: null,
    });
    return apiResponse({ activation, nextAction });
  }
}
