import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { buildOnboardingProjectWithId } from '@/lib/onboarding/build-onboarding-project';
import {
  getPilotSnapshotForUser,
  syncPilotSnapshotForUser,
} from '@/lib/deal-network-demo/pilot-snapshot.server';
import { saveOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import type { OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';
import {
  createOperationId,
  recoverableFailure,
  nonRecoverableFailure,
  successResult,
  toClientMutationResult,
  classifyMutationError,
  type MutationResult,
} from '@/lib/onboarding/mutation-resilience';
import { log } from '@/lib/logger';
import {
  runOperationalInitializationConvergence,
} from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';

const schema = z.object({
  projectName: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  estimatedValue: z.number().nonnegative().optional(),
  defaultCurrency: z.string().length(3),
  onboarding_use_case: z.string().optional(),
  onboarding_context: z.string().optional(),
  operationId: z.string().max(64).optional(),
  existingProjectId: z.string().max(128).optional(),
});

type BootstrapPayload = {
  organizationId: string;
  merchantSettingsId: string | null;
  projectId: string;
};

function logBootstrap(
  operationId: string,
  event: string,
  meta?: Record<string, unknown>
) {
  log.info('onboarding.bootstrap-project', { operationId, event, ...meta });
}

async function safeOperationalDerivation(operationId: string): Promise<string | undefined> {
  try {
    const { deriveWorkspaceActivationFromOperations } = await import(
      '@/lib/operations/orchestration/activation-bridge'
    );
    deriveWorkspaceActivationFromOperations({
      hasOrganization: true,
      onboardingCompleted: false,
      projectCreated: true,
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
    return undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logBootstrap(operationId, 'operational_derivation_degraded', { message });
    return 'Operational status will update shortly — your project is saved.';
  }
}

async function persistProjectForUser(
  userId: string,
  project: ReturnType<typeof buildOnboardingProjectWithId>,
  operationId: string
): Promise<{ warning?: string }> {
  try {
    const snapshot = await getPilotSnapshotForUser(userId);
    const deals = [...snapshot.deals.filter((d) => d.id !== project.id), project];
    await syncPilotSnapshotForUser(userId, deals, snapshot.participants);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logBootstrap(operationId, 'pilot_sync_failed', { message });
    return {
      warning:
        'Your project record was saved, but workspace sync is still finishing. Refresh or retry shortly.',
    };
  }
}

async function runBootstrap(
  userId: string,
  body: z.infer<typeof schema>,
  operationId: string
): Promise<{ mutation: MutationResult<BootstrapPayload>; httpStatus: number }> {
  const useCaseLabel = body.onboarding_use_case as OnboardingUseCaseId | undefined;
  const currency = body.defaultCurrency as 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'JPY' | 'SGD' | 'NZD';

  let existingProjectId = body.existingProjectId?.trim() || undefined;
  if (!existingProjectId) {
    try {
      const snapshot = await getPilotSnapshotForUser(userId);
      const match = snapshot.deals.find(
        (d) => d.dealName === body.projectName.trim() && d.id.startsWith('onb-deal-')
      );
      if (match) existingProjectId = match.id;
    } catch {
      /* ignore */
    }
  }

  const project = buildOnboardingProjectWithId({
    projectName: body.projectName,
    description: body.description,
    estimatedValue: body.estimatedValue,
    currency,
    projectId: existingProjectId,
  });

  const warnings: string[] = [];
  const existingOrg = await getOrganizationForAuthenticatedUser(userId);

  if (existingOrg) {
    logBootstrap(operationId, 'existing_org_path', { organizationId: existingOrg.id });

    const syncResult = await persistProjectForUser(userId, project, operationId);
    if (syncResult.warning) warnings.push(syncResult.warning);

    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: existingOrg.id },
      select: { id: true },
    });

    if (settings) {
      await prisma.merchant_settings.update({
        where: { id: settings.id },
        data: { default_currency: body.defaultCurrency },
      });
    } else {
      await prisma.merchant_settings.create({
        data: {
          organization_id: existingOrg.id,
          display_name: 'Workspace',
          default_currency: body.defaultCurrency,
        },
      });
    }

    try {
      await saveOperatorOnboardingState(existingOrg.id, userId, {
        step: 'participants',
        onboarding_use_case: useCaseLabel,
        onboarding_context: body.onboarding_context,
        organizationId: existingOrg.id,
        merchantSettingsId: settings?.id,
        projectId: project.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logBootstrap(operationId, 'onboarding_state_save_failed', { message });
      warnings.push('Project created — onboarding progress will sync on retry.');
    }

    const opWarning = await safeOperationalDerivation(operationId);
    if (opWarning) warnings.push(opWarning);

    return {
      httpStatus: 200,
      mutation: successResult(
        {
          organizationId: existingOrg.id,
          merchantSettingsId: settings?.id ?? null,
          projectId: project.id,
        },
        operationId,
        warnings.length ? { operationalWarning: warnings.join(' ') } : undefined
      ),
    };
  }

  logBootstrap(operationId, 'new_org_path');

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organizations.create({
      data: {
        name: 'Workspace',
        clerk_org_id: `onb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      },
    });

    await tx.user_organizations.create({
      data: {
        user_id: userId,
        organization_id: organization.id,
        role: 'OWNER',
      },
    });

    const settings = await tx.merchant_settings.create({
      data: {
        organization_id: organization.id,
        display_name: 'Workspace',
        default_currency: body.defaultCurrency,
      },
    });

    return { organization, settings };
  });

  const syncResult = await persistProjectForUser(userId, project, operationId);
  if (syncResult.warning) warnings.push(syncResult.warning);

  try {
    await saveOperatorOnboardingState(result.organization.id, userId, {
      step: 'participants',
      onboarding_use_case: useCaseLabel,
      onboarding_context: body.onboarding_context,
      organizationId: result.organization.id,
      merchantSettingsId: result.settings.id,
      projectId: project.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logBootstrap(operationId, 'onboarding_state_save_failed', { message });
    warnings.push('Workspace created — onboarding progress will sync on retry.');
  }

  const opWarning = await safeOperationalDerivation(operationId);
  if (opWarning) warnings.push(opWarning);

  return {
    httpStatus: 201,
    mutation: successResult(
      {
        organizationId: result.organization.id,
        merchantSettingsId: result.settings.id,
        projectId: project.id,
      },
      operationId,
      warnings.length ? { operationalWarning: warnings.join(' ') } : undefined
    ),
  };
}

/**
 * POST /api/onboarding/bootstrap-project
 */
export async function POST(request: NextRequest) {
  const operationId = createOperationId();

  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { data: body, error } = await validateBody(request, schema);
    if (error) {
      return error;
    }

    const opId = body.operationId?.trim() || operationId;
    logBootstrap(opId, 'started', { userId: user.id, projectName: body.projectName });

    const isNewAgreement = !body.existingProjectId?.trim();
    if (isNewAgreement) {
      const orgForGate = await getOrganizationForAuthenticatedUser(user.id);
      if (orgForGate) {
        const { requireEntitlement } = await import('@/lib/entitlements/gate-api.server');
        const entitlementBlock = await requireEntitlement({
          organizationId: orgForGate.id,
          userId: user.id,
          userEmail: user.email,
          feature: 'create_agreement',
        });
        if (entitlementBlock) return entitlementBlock;
      }
    }

    try {
      const { mutation, httpStatus } = await runBootstrap(user.id, body, opId);
      const clientMutation = toClientMutationResult(mutation);

      logBootstrap(opId, mutation.status, { projectId: mutation.data?.projectId });

      let convergence;
      if (
        (mutation.status === 'SUCCESS' || mutation.status === 'PARTIAL_SUCCESS') &&
        mutation.data?.projectId
      ) {
        convergence = await runOperationalInitializationConvergence({
          userId: user.id,
          organizationId: mutation.data.organizationId,
          projectId: mutation.data.projectId,
          triggerSource: 'bootstrap-project',
          orchestrate: false,
        });
      }

      return apiResponse(
        {
          ...mutation.data,
          mutation: clientMutation,
          correlationId: convergence?.correlationId,
          operationalInitialization: convergence?.snapshot,
          operationalOnboarding: convergence?.onboarding,
        },
        httpStatus
      );
    } catch (err) {
      const { recoverable, internalCause } = classifyMutationError(err);
      logBootstrap(opId, 'mutation_failed', { recoverable, internalCause });

      const mutation = recoverable
        ? recoverableFailure(
            opId,
            'We could not finish configuring your project yet. Your project details were preserved safely.',
            internalCause
          )
        : nonRecoverableFailure(
            opId,
            'We could not complete workspace setup. Your details are preserved — contact support if this continues.',
            internalCause
          );

      return NextResponse.json(
        {
          error: mutation.recoveryMessage,
          mutation: toClientMutationResult(mutation),
        },
        { status: recoverable ? 503 : 422 }
      );
    }
  } catch (err) {
    const { recoverable, internalCause } = classifyMutationError(err);
    log.error('onboarding.bootstrap-project.unhandled', { operationId, internalCause });

    const mutation = recoverable
      ? recoverableFailure(
          operationId,
          'We could not finish configuring your project yet. Your project details were preserved safely.',
          internalCause
        )
      : nonRecoverableFailure(
          operationId,
          'We could not complete workspace setup. Your details are preserved — contact support if this continues.',
          internalCause
        );

    return NextResponse.json(
      {
        error: mutation.recoveryMessage,
        mutation: toClientMutationResult(mutation),
      },
      { status: recoverable ? 503 : 422 }
    );
  }
}
