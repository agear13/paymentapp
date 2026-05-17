import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { apiError, apiResponse, validateBody } from '@/lib/api/middleware';
import { prisma } from '@/lib/server/prisma';
import { buildOnboardingProject } from '@/lib/onboarding/build-onboarding-project';
import { syncPilotSnapshotForUser } from '@/lib/deal-network-demo/pilot-snapshot.server';
import { saveOperatorOnboardingState } from '@/lib/onboarding/operator-onboarding.server';
import type { OnboardingUseCaseId } from '@/lib/onboarding/operator-onboarding-types';

const schema = z.object({
  projectName: z.string().min(2).max(255),
  description: z.string().max(2000).optional(),
  estimatedValue: z.number().nonnegative().optional(),
  defaultCurrency: z.string().length(3),
  onboarding_use_case: z.string().optional(),
  onboarding_context: z.string().optional(),
});

/**
 * POST /api/onboarding/bootstrap-project
 * Creates organization + merchant settings + first project for workflow onboarding.
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

  const existingOrg = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT o.id FROM organizations o
    INNER JOIN user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = ${user.id}
    LIMIT 1
  `;

  if (existingOrg.length > 0) {
    return apiError('Organization already exists', 409);
  }

  const project = buildOnboardingProject({
    projectName: body.projectName,
    description: body.description,
    estimatedValue: body.estimatedValue,
    currency: body.defaultCurrency as 'USD',
  });

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organizations.create({
      data: {
        name: body.projectName.trim(),
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
        display_name: body.projectName.trim(),
        default_currency: body.defaultCurrency,
      },
    });

    return { organization, settings };
  });

  await syncPilotSnapshotForUser(user.id, [project], []);

  const useCaseLabel = body.onboarding_use_case as OnboardingUseCaseId | undefined;
  await saveOperatorOnboardingState(result.organization.id, user.id, {
    step: 'participants',
    onboarding_use_case: useCaseLabel,
    onboarding_context: body.onboarding_context,
    organizationId: result.organization.id,
    merchantSettingsId: result.settings.id,
    projectId: project.id,
  });

  return apiResponse(
    {
      organizationId: result.organization.id,
      merchantSettingsId: result.settings.id,
      projectId: project.id,
    },
    201
  );
}
