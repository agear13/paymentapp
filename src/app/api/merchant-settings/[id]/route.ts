import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { AuditEventType, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { apiResponse, apiError, validateBody } from '@/lib/api/middleware';
import { log } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { runOperationalInitializationConvergence } from '@/lib/operations/onboarding/run-operational-initialization-convergence.server';
import { operationalInitializationEvent } from '@/lib/operations/onboarding/operational-initialization-events';

const updateMerchantSettingsSchema = z.object({
  displayName: z.string().min(2).max(255).optional(),
  // Accept both full URLs (http/https) and relative paths (/uploads/...)
  organizationLogoUrl: z.string().min(1).optional(),
  defaultCurrency: z.string().length(3).optional(),
  stripeAccountId: z.string().optional(),
  hederaAccountId: z.string().min(1).optional(),
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

    const canViewSettings = await hasOrganizationPermission(
      user.id,
      settings.organization_id,
      'view_settings'
    );
    if (!canViewSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

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
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { id } = await params;
    const { data: body, error } = await validateBody(request, updateMerchantSettingsSchema);
    
    if (error) {
      return error;
    }

    const existing = await prisma.merchant_settings.findUnique({
      where: { id },
      select: {
        organization_id: true,
        stripe_account_id: true,
        wise_profile_id: true,
        wise_enabled: true,
        wise_currency: true,
      },
    });
    if (!existing) {
      return apiError('Merchant settings not found', 404);
    }

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      existing.organization_id,
      'manage_settings'
    );
    if (!canManageSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

    // Partial update: only set fields explicitly provided (pilot saves may send Stripe/Wise/HashPack only).
    const updateData: Record<string, unknown> = {};
    if (body.displayName !== undefined) updateData.display_name = body.displayName;
    if (body.organizationLogoUrl !== undefined) updateData.organization_logo_url = body.organizationLogoUrl;
    if (body.defaultCurrency !== undefined) updateData.default_currency = body.defaultCurrency;
    if (body.stripeAccountId !== undefined) updateData.stripe_account_id = body.stripeAccountId;
    if (body.hederaAccountId !== undefined) updateData.hedera_account_id = body.hederaAccountId;
    if (body.wiseProfileId !== undefined) updateData.wise_profile_id = body.wiseProfileId;
    if (body.wiseEnabled !== undefined) updateData.wise_enabled = body.wiseEnabled;
    if (body.wiseCurrency !== undefined) updateData.wise_currency = body.wiseCurrency;

    const settings = await prisma.merchant_settings.update({
      where: { id },
      data: updateData as Parameters<typeof prisma.merchant_settings.update>[0]['data'],
    });

    log.info(`Updated merchant settings: ${id} by user ${user.id}`);

    const auditCtx = extractRequestAuditContext(request);
    if (body.stripeAccountId !== undefined) {
      void createAuditLog({
        eventType: AuditEventType.STRIPE_SETTINGS_CHANGED,
        severity: AuditSeverity.INFO,
        userId: user.id,
        organizationId: existing.organization_id,
        resource: 'merchant_settings',
        resourceId: id,
        action: 'update',
        oldValue: JSON.stringify({ stripeAccountId: existing.stripe_account_id }),
        newValue: JSON.stringify({ stripeAccountId: body.stripeAccountId }),
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
        timestamp: new Date(),
      });
    }
    if (
      body.wiseProfileId !== undefined ||
      body.wiseEnabled !== undefined ||
      body.wiseCurrency !== undefined
    ) {
      void createAuditLog({
        eventType: AuditEventType.WISE_SETTINGS_CHANGED,
        severity: AuditSeverity.INFO,
        userId: user.id,
        organizationId: existing.organization_id,
        resource: 'merchant_settings',
        resourceId: id,
        action: 'update',
        oldValue: JSON.stringify({
          wiseProfileId: existing.wise_profile_id,
          wiseEnabled: existing.wise_enabled,
          wiseCurrency: existing.wise_currency,
        }),
        newValue: JSON.stringify({
          wiseProfileId: body.wiseProfileId,
          wiseEnabled: body.wiseEnabled,
          wiseCurrency: body.wiseCurrency,
        }),
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
        correlationId: auditCtx.correlationId,
        timestamp: new Date(),
      });
    }

    const railUpdated =
      body.stripeAccountId !== undefined ||
      body.hederaAccountId !== undefined ||
      body.wiseProfileId !== undefined ||
      body.wiseEnabled !== undefined;

    let operationalOnboarding;
    let operationalInitialization;
    let correlationId;
    if (railUpdated) {
      if (body.stripeAccountId !== undefined) {
        const stripeEvent = operationalInitializationEvent('STRIPE_CONNECT_COMPLETED', {
          organizationId: existing.organization_id,
          correlationId: `stripe-${id}`,
          payload: { merchantSettingsId: id },
        });
        log.info(`[operational-onboarding] ${stripeEvent.type}`, stripeEvent.payload);
      }
      const convergence = await runOperationalInitializationConvergence({
        userId: user.id,
        organizationId: existing.organization_id,
        triggerSource: 'merchant-settings-patch',
        orchestrate: true,
      });
      operationalOnboarding = convergence.onboarding;
      operationalInitialization = convergence.snapshot;
      correlationId = convergence.correlationId;
    }

    return apiResponse({
      settings,
      operationalOnboarding,
      operationalInitialization,
      correlationId,
    });
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
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const { id } = await params;

    const existing = await prisma.merchant_settings.findUnique({
      where: { id },
      select: { organization_id: true },
    });
    if (!existing) {
      return apiError('Merchant settings not found', 404);
    }

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      existing.organization_id,
      'manage_settings'
    );
    if (!canManageSettings) {
      return apiError('Forbidden - insufficient organization permissions', 403);
    }

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




