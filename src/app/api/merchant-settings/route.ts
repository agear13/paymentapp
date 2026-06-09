import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import config from '@/lib/config/env';
import { resolveWiseFieldsForCreate } from '@/lib/merchant-settings/resolve-wise-create-fields';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { runOperationalInitializationConvergence } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';

const createMerchantSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string().min(2).max(255),
  organizationLogoUrl: z.string().min(1).optional(),
  defaultCurrency: z.string().length(3),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().min(1).optional(),
  // Wise settings
  wiseProfileId: z.string().optional(),
  wiseEnabled: z.boolean().optional(),
  wiseCurrency: z.string().length(3).optional(),
});

// GET /api/merchant-settings?organizationId=xxx
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return apiError('organizationId is required', 400);
    }

    const canViewSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'view_settings'
    );
    if (!canViewSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

    const settings = await prisma.merchant_settings.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });

    // Include global feature flags in response for client-side checks
    const settingsWithFeatures = settings.map(s => ({
      ...s,
      _features: {
        wiseGloballyEnabled: config.features.wisePayments,
      },
    }));

    return apiResponse(settingsWithFeatures);
  } catch (error) {
    log.error(`Failed to fetch merchant settings: ${error}`);
    return apiError('Failed to fetch merchant settings', 500);
  }
}

// POST /api/merchant-settings
export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { data: body, error } = await validateBody(request, createMerchantSettingsSchema);
    
    if (error) {
      return error;
    }

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      body.organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

    const wiseFields = resolveWiseFieldsForCreate({
      wiseProfileId: body.wiseProfileId,
      wiseEnabled: body.wiseEnabled,
      wiseCurrency: body.wiseCurrency,
    });

    if (wiseFields.wise_enabled && !wiseFields.wise_profile_id && config.isDevelopment) {
      log.warn(
        `Wise enabled for new merchant settings but no profile ID. Complete Wise in merchant settings before payouts.`
      );
    }

    // Build create data, including wise fields (may not be in generated types yet)
    const createData: Record<string, unknown> = {
      organization_id: body.organizationId,
      display_name: body.displayName,
      organization_logo_url: body.organizationLogoUrl,
      default_currency: body.defaultCurrency,
      stripe_account_id: body.stripeAccountId,
      hedera_account_id: body.hederaAccountId,
      wise_profile_id: wiseFields.wise_profile_id,
      wise_enabled: wiseFields.wise_enabled,
      wise_currency: wiseFields.wise_currency,
    };

    const settings = await prisma.merchant_settings.create({
      data: createData as Parameters<typeof prisma.merchant_settings.create>[0]['data'],
    });

    log.info(
      `Created merchant settings: ${settings.id} for org ${body.organizationId} (wise_enabled=${wiseFields.wise_enabled}, wise_profile_id=${wiseFields.wise_profile_id ? 'set' : 'null'})`
    );

    const railIncluded =
      Boolean(body.stripeAccountId) ||
      Boolean(body.hederaAccountId) ||
      Boolean(body.wiseProfileId) ||
      wiseFields.wise_enabled;

    let operationalOnboarding;
    let operationalInitialization;
    let correlationId;
    if (railIncluded) {
      const convergence = await runOperationalInitializationConvergence({
        userId: user.id,
        organizationId: body.organizationId,
        triggerSource: 'merchant-settings-create',
        orchestrate: true,
      });
      operationalOnboarding = convergence.onboarding;
      operationalInitialization = convergence.snapshot;
      correlationId = convergence.correlationId;
    }

    return apiResponse({ settings, operationalOnboarding, operationalInitialization, correlationId }, 201);
  } catch (error) {
    log.error(`Failed to create merchant settings: ${error}`);
    return apiError('Failed to create merchant settings', 500);
  }
}




