import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';

const updateMerchantSettingsSchema = z.object({
  displayName: z.string().min(2).max(255).optional(),
  // Accept both full URLs (http/https) and relative paths (/uploads/...)
  organizationLogoUrl: z.string().min(1).optional(),
  defaultCurrency: z.string().length(3).optional(),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().regex(/^0\.0\.\d+$/).optional(),
  // Wise settings
  wiseProfileId: z.string().optional().nullable(),
  wiseEnabled: z.boolean().optional(),
  wiseCurrency: z.string().length(3).optional().nullable(),
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

    const settings = await prisma.merchant_settings.findUnique({
      where: { id },
      include: {
        organizations: {
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
    log.error(`Failed to fetch merchant settings: ${error}`);
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
    const { data: body, error } = await validateBody(request, updateMerchantSettingsSchema);
    
    if (error) {
      return error;
    }

    // TODO: Check if user has permission to update these settings

    // Build update data, including wise fields (may not be in generated types yet)
    const updateData: Record<string, unknown> = {
      display_name: body.displayName,
      organization_logo_url: body.organizationLogoUrl,
      default_currency: body.defaultCurrency,
      stripe_account_id: body.stripeAccountId,
      hedera_account_id: body.hederaAccountId,
    };
    
    // Add wise fields if provided
    if (body.wiseProfileId !== undefined) updateData.wise_profile_id = body.wiseProfileId;
    if (body.wiseEnabled !== undefined) updateData.wise_enabled = body.wiseEnabled;
    if (body.wiseCurrency !== undefined) updateData.wise_currency = body.wiseCurrency;

    const settings = await prisma.merchant_settings.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.merchant_settings.update>[0]['data'],
    });

    log.info(`Updated merchant settings: ${id} by user ${user.id}`);

    return apiResponse(settings);
  } catch (error) {
    log.error(`Failed to update merchant settings: ${error}`);
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

    await prisma.merchant_settings.delete({
      where: { id },
    });

    log.info(`Deleted merchant settings: ${id} by user ${user.id}`);

    return apiResponse({ success: true });
  } catch (error) {
    log.error(`Failed to delete merchant settings: ${error}`);
    return apiError('Failed to delete merchant settings', 500);
  }
}




