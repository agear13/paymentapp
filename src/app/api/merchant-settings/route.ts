import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const createMerchantSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  displayName: z.string().min(2).max(255),
  defaultCurrency: z.string().length(3),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().regex(/^0\.0\.\d+$/).optional(),
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
    log.error({ error }, 'Failed to fetch merchant settings');
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

    const settings = await prisma.merchant_settings.create({
      data: {
        organization_id: body.organizationId,
        display_name: body.displayName,
        default_currency: body.defaultCurrency,
        stripe_account_id: body.stripeAccountId,
        hedera_account_id: body.hederaAccountId,
      },
    });

    log.info({ settingsId: settings.id, organizationId: body.organizationId }, 'Created merchant settings');

    return apiResponse(settings, 201);
  } catch (error) {
    log.error({ error }, 'Failed to create merchant settings');
    return apiError('Failed to create merchant settings', 500);
  }
}




