import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import config from '@/lib/config/env';

const createMerchantSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string().min(2).max(255),
  defaultCurrency: z.string().length(3),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().regex(/^0\.0\.\d+$/).optional(),
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

    // TODO: Check if user has access to this organization

    const settings = await prisma.merchant_settings.findMany({
      where: { organization_id: organizationId },
      orderBy: { created_at: 'desc' },
    });

    return apiResponse(settings);
  } catch (error) {
    log.error(`Failed to fetch merchant settings: ${error}`);
    return apiError('Failed to fetch merchant settings', 500);
  }
}

// POST /api/merchant-settings
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { data: body, error } = await validateBody(request, createMerchantSettingsSchema);
    
    if (error) {
      return error;
    }

    // TODO: Check if user has permission to create settings for this organization

    // Resolve Wise defaults for new merchant settings (auto-enable for beta orgs)
    // Only apply defaults if caller did NOT explicitly provide these values
    const resolvedWiseProfileId = body.wiseProfileId !== undefined 
      ? body.wiseProfileId 
      : config.wise.defaultProfileId;
    
    const resolvedWiseEnabled = body.wiseEnabled !== undefined 
      ? body.wiseEnabled 
      : true; // Default to enabled for new orgs
    
    const resolvedWiseCurrency = body.wiseCurrency !== undefined 
      ? body.wiseCurrency 
      : (body.defaultCurrency || 'AUD');

    // DEV warning if Wise is enabled but no profile ID
    if (resolvedWiseEnabled && !resolvedWiseProfileId && config.isDevelopment) {
      log.warn(`Wise enabled for new merchant settings but no profile ID available. Wise won't show on public pay page. Set DEFAULT_WISE_PROFILE_ID or WISE_PROFILE_ID env var.`);
    }

    // Build create data, including wise fields (may not be in generated types yet)
    const createData: Record<string, unknown> = {
      organization_id: body.organizationId,
      display_name: body.displayName,
      default_currency: body.defaultCurrency,
      stripe_account_id: body.stripeAccountId,
      hedera_account_id: body.hederaAccountId,
      wise_profile_id: resolvedWiseProfileId,
      wise_enabled: resolvedWiseEnabled,
      wise_currency: resolvedWiseCurrency,
    };

    const settings = await prisma.merchant_settings.create({
      data: createData as Parameters<typeof prisma.merchant_settings.create>[0]['data'],
    });

    log.info(`Created merchant settings: ${settings.id} for org ${body.organizationId} (wise_enabled=${resolvedWiseEnabled}, wise_profile_id=${resolvedWiseProfileId ? 'set' : 'null'})`);

    return apiResponse(settings, 201);
  } catch (error) {
    log.error(`Failed to create merchant settings: ${error}`);
    return apiError('Failed to create merchant settings', 500);
  }
}




