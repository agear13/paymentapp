import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getOrganizationForAuthenticatedUser } from '@/lib/auth/get-org';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { saveOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import { DEFAULT_WORKSPACE_CURRENCY, isWorkspaceCurrencyCode } from '@/lib/currency/workspace-currencies';
import { runOperationalInitializationConvergence } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';

const schema = z.object({
  workspaceName: z.string().min(2).max(255),
  defaultCurrency: z.string().length(3),
  industry: z.string().max(120).optional(),
  teamSize: z.string().max(64).optional(),
});

/**
 * POST /api/onboarding/bootstrap-workspace
 * Creates workspace (organization + merchant settings) before project setup.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError('Unauthorized', 401);
  }

  const { data: body, error } = await validateBody(request, schema);
  if (error) {
    return error;
  }

  const currency = isWorkspaceCurrencyCode(body.defaultCurrency)
    ? body.defaultCurrency
    : DEFAULT_WORKSPACE_CURRENCY;

  const existingOrg = await getOrganizationForAuthenticatedUser(user.id);
  if (existingOrg) {
    const settings = await prisma.merchant_settings.findFirst({
      where: { organization_id: existingOrg.id },
      select: { id: true },
    });

    await prisma.merchant_settings.updateMany({
      where: { organization_id: existingOrg.id },
      data: {
        display_name: body.workspaceName.trim(),
        default_currency: currency,
      },
    });

    await saveOperatorOnboardingState(existingOrg.id, user.id, {
      step: 'use_case',
      workspace_name: body.workspaceName.trim(),
      workspace_industry: body.industry,
      workspace_team_size: body.teamSize,
      organizationId: existingOrg.id,
      merchantSettingsId: settings?.id,
    });

    const convergence = await runOperationalInitializationConvergence({
      userId: user.id,
      organizationId: existingOrg.id,
      triggerSource: 'bootstrap-workspace',
    });

    return apiResponse({
      organizationId: existingOrg.id,
      merchantSettingsId: settings?.id ?? null,
      correlationId: convergence.correlationId,
      operationalInitialization: convergence.snapshot,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organizations.create({
      data: {
        name: body.workspaceName.trim(),
        clerk_org_id: `onb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      },
    });

    await tx.user_organizations.create({
      data: {
        user_id: user.id,
        organization_id: organization.id,
        role: 'OWNER',
      },
    });

    const settings = await tx.merchant_settings.create({
      data: {
        organization_id: organization.id,
        display_name: body.workspaceName.trim(),
        default_currency: currency,
      },
    });

    return { organization, settings };
  });

  await saveOperatorOnboardingState(result.organization.id, user.id, {
    step: 'use_case',
    workspace_name: body.workspaceName.trim(),
    workspace_industry: body.industry,
    workspace_team_size: body.teamSize,
    organizationId: result.organization.id,
    merchantSettingsId: result.settings.id,
  });

  const convergence = await runOperationalInitializationConvergence({
    userId: user.id,
    organizationId: result.organization.id,
    triggerSource: 'bootstrap-workspace',
  });

  return apiResponse(
    {
      organizationId: result.organization.id,
      merchantSettingsId: result.settings.id,
      correlationId: convergence.correlationId,
      operationalInitialization: convergence.snapshot,
    },
    201
  );
}
