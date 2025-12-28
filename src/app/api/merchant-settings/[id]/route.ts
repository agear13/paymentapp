import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const updateMerchantSettingsSchema = z.object({
  displayName: z.string().min(2).max(255).optional(),
  defaultCurrency: z.string().length(3).optional(),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().regex(/^0\.0\.\d+$/).optional(),
});

// GET /api/merchant-settings/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;

    const settings = await prisma.merchant_settingss.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!settings) {
      return apiError('Merchant settings not found', 404);
    }

    // TODO: Check if user has access to this organization

    return apiResponse(settings);
  } catch (error) {
    log.error({ error }, 'Failed to fetch merchant settings');
    return apiError('Failed to fetch merchant settings', 500);
  }
}

// PATCH /api/merchant-settings/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;
    const body = await validateBody(request, updateMerchantSettingsSchema);
    
    if (body instanceof NextResponse) {
      return body;
    }

    // TODO: Check if user has permission to update these settings

    const settings = await prisma.merchant_settingss.update({
      where: { id },
      data: body,
    });

    log.info({ settingsId: id, userId: user.id }, 'Updated merchant settings');

    return apiResponse(settings);
  } catch (error) {
    log.error({ error }, 'Failed to update merchant settings');
    return apiError('Failed to update merchant settings', 500);
  }
}

// DELETE /api/merchant-settings/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return apiError('Unauthorized', 401);
    }

    const { id } = await params;

    // TODO: Check if user has permission to delete these settings

    await prisma.merchant_settingss.delete({
      where: { id },
    });

    log.info({ settingsId: id, userId: user.id }, 'Deleted merchant settings');

    return apiResponse({ success: true });
  } catch (error) {
    log.error({ error }, 'Failed to delete merchant settings');
    return apiError('Failed to delete merchant settings', 500);
  }
}




