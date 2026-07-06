import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { getOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { getPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { merchantRowToRailFlags } from '@/lib/onboarding/workspace-activation-state';
import config from '@/lib/config/env';
import { evaluateWorkspaceCompensationReadiness } from '@/lib/participants/participant-compensation';
import { safeDeriveActivationResponse } from '@/lib/onboarding/workspace-activation-fallback';
import { resolveOperationalCoordinationSnapshot } from '@/lib/operations/selectors/resolve-operational-coordination.server';
import { activationFromOperationalGraph } from '@/lib/operations/selectors/operational-graph-adapter';
import { deriveNextRecommendedAction } from '@/lib/onboarding/next-recommended-action';
import { resolveOperationalInitializationSnapshot } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import {
  createOperationalApiRouteContext,
  logOperationalApiRoutePhase,
  runOperationalApiRoute,
} from '@/lib/operations/dev/api-route-diagnostics.server';

function logActivationTrace(
  ctx: ReturnType<typeof createOperationalApiRouteContext>,
  phase: string,
  extra: Record<string, unknown> = {}
): void {
  console.info('[activation-trace]', {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    route: ctx.route,
    projectId: ctx.projectId,
    phase,
    dbQueryCount: extra.dbQueryCount ?? undefined,
    at: new Date().toISOString(),
    ...extra,
  });
}

/** GET /api/workspace/activation — derived activation snapshot from canonical operational graph */
export async function GET(request: Request) {
  const ctx = createOperationalApiRouteContext({
    route: '/api/workspace/activation',
    request,
  });

  return runOperationalApiRoute(ctx, async () => {
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
          evmWalletConfigured: false,
          anyRailConfigured: false,
          releaseEligibleCount: 0,
          releaseBatchCount: 0,
          primaryProjectId: null,
        });
        return apiResponse({ activation, nextAction });
      }

      const initStartedAt = Date.now();
      const initSnapshot = await resolveOperationalInitializationSnapshot({
        userId: user.id,
        organizationId: org.id,
      });
      const initializationDurationMs = Date.now() - initStartedAt;
      logOperationalApiRoutePhase(ctx, {
        phase: 'initialization',
        durationMs: initializationDurationMs,
        initializationDurationMs,
        success: true,
      });
      logActivationTrace(ctx, 'initialization-complete', {
        initializationDurationMs,
        organizationId: org.id,
      });

      const onboardingState = initSnapshot.onboarding;
      ctx.projectId =
        onboardingState.primaryProjectId ??
        initSnapshot.onboarding.primaryProjectId ??
        ctx.projectId;

      const parallelStartedAt = Date.now();
      const [merchant, persistedOnboarding, snapshot, paymentLinkCount, releaseBatchCount] =
        await Promise.all([
          prisma.merchant_settings.findFirst({
            where: { organization_id: org.id },
            select: {
              default_currency: true,
              stripe_account_id: true,
              hedera_account_id: true,
              evm_wallet_enabled: true,
              evm_wallet_address: true,
              evm_supported_networks: true,
              evm_supported_tokens: true,
              wise_enabled: true,
              wise_profile_id: true,
            },
          }),
          getOperatorOnboardingState(org.id),
          getPilotSnapshotForUser(user.id).catch(() => ({ deals: [], participants: [] })),
          prisma.payment_links.count({ where: { organization_id: org.id } }).catch(() => 0),
          prisma.payout_batches.count({ where: { organization_id: org.id } }).catch(() => 0),
        ]);

      logOperationalApiRoutePhase(ctx, {
        phase: 'pilot-snapshot+parallel-db',
        durationMs: Date.now() - parallelStartedAt,
        success: true,
        extra: {
          projectCount: snapshot.deals.length,
          participantCount: snapshot.participants.length,
        },
      });
      logActivationTrace(ctx, 'pilot-snapshot-complete', {
        durationMs: Date.now() - parallelStartedAt,
        projectCount: snapshot.deals.length,
        participantCount: snapshot.participants.length,
        organizationId: org.id,
      });

      const rails = merchantRowToRailFlags(merchant, {
        wisePayments: config.features.wisePayments,
        evmWalletPayments: config.features.evmWalletPayments,
      });
      const projectCreated =
        snapshot.deals.length > 0 ||
        Boolean(onboardingState.projectReady || persistedOnboarding?.projectId);
      const compensation = evaluateWorkspaceCompensationReadiness(snapshot.participants);
      const primaryProjectId =
        onboardingState.primaryProjectId ??
        persistedOnboarding?.projectId ??
        snapshot.deals[0]?.id ??
        null;

      ctx.projectId = primaryProjectId;

      const graphStartedAt = Date.now();
      const graph = await resolveOperationalCoordinationSnapshot({
        userId: user.id,
        projectId: primaryProjectId,
        participants: snapshot.participants,
      });
      const graphBuildDurationMs = Date.now() - graphStartedAt;
      logOperationalApiRoutePhase(ctx, {
        phase: 'graph-build',
        durationMs: graphBuildDurationMs,
        graphBuildDurationMs,
        success: true,
      });
      logActivationTrace(ctx, 'graph-build-complete', {
        graphBuildDurationMs,
        participantCount: graph.summary.participantCount,
        obligationCount: graph.obligations.length,
      });

      const activationInput = {
        hasOrganization: true,
        onboardingCompleted: persistedOnboarding?.completed === true,
        projectCreated,
        participantCount: compensation.participantCount,
        participantsConfigured: compensation.participantsConfigured,
        participantsConfiguredCount: compensation.configuredCount,
        obligationCount: graph.obligations.length,
        paymentLinkCount,
        collectionPreferenceDecideLater:
          persistedOnboarding?.collection_preference === 'decide_later' ||
          persistedOnboarding?.collection_preference == null,
        defaultCurrency: merchant?.default_currency ?? null,
        ...rails,
        releaseEligibleCount: graph.summary.releaseReadyCount,
        releaseBatchCount,
        primaryProjectId,
      };

      const blockerStartedAt = Date.now();
      const activation = activationFromOperationalGraph(graph, activationInput);
      const nextAction = deriveNextRecommendedAction(activation);
      const blockerDerivationDurationMs = Date.now() - blockerStartedAt;
      logActivationTrace(ctx, 'blocker-derivation-complete', {
        blockerDerivationDurationMs,
        releaseEligibleCount: graph.summary.releaseReadyCount,
        payoutReadyCount: graph.summary.payoutReadyCount,
      });

      const persistedTruth = compensation.participantCount > 0;

      logActivationTrace(ctx, 'request-complete', {
        totalDurationMs: Date.now() - ctx.startedAt,
        initializationDurationMs,
        graphBuildDurationMs,
        blockerDerivationDurationMs,
        projectCount: snapshot.deals.length,
        participantCount: compensation.participantCount,
      });

      return apiResponse({
        activation: {
          ...activation,
          degraded: persistedTruth ? false : activation.degraded,
          needsGuidance: persistedTruth ? activation.needsGuidance : true,
        },
        nextAction,
        operationalOnboarding: onboardingState,
        operationalInitialization: initSnapshot,
        correlationId: initSnapshot.correlationId,
        operationalGraph: { summary: graph.summary, funding: graph.funding },
      });
    } catch (e) {
      console.error('[workspace/activation GET]', e);
      logActivationTrace(ctx, 'request-error', {
        totalDurationMs: Date.now() - ctx.startedAt,
        errorMessage: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
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
      return apiResponse({
        activation: {
          ...activation,
          phaseLabel:
            'Settlement infrastructure is still initializing. Your payment rails were connected successfully. Operational coordination is being prepared.',
          degraded: true,
        },
        nextAction,
      });
    }
  });
}
