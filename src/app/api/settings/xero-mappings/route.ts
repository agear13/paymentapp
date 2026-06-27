/**
 * Xero Account Mappings API Endpoint
 * Manages saving and retrieving Xero account mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { AuditEventType, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { prisma } from '@/lib/server/prisma';
import { logger } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { validateMappedAccountCodes } from '@/lib/xero/accounts-service';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';

// GET /api/settings/xero-mappings?organization_id=xxx
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get organization from query params
    const { searchParams } = new URL(request.url);

    const resolved = await resolveSessionOrganizationId(
      user.id,
      searchParams.get('organization_id'),
      'settings/xero-mappings GET'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

    const canViewSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'view_settings'
    );
    if (!canViewSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    // Fetch merchant settings with Xero mappings
    const settings = await prisma.merchant_settings.findFirst({
      where: {
        organization_id: organizationId,
      },
      select: {
        xero_revenue_account_id: true,
        xero_receivable_account_id: true,
        xero_stripe_clearing_account_id: true,
        xero_hbar_clearing_account_id: true,
        xero_usdc_clearing_account_id: true,
        xero_usdt_clearing_account_id: true,
        xero_audd_clearing_account_id: true,
        xero_fee_expense_account_id: true,
      },
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    logger.error('Error fetching Xero mappings', { error });
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/xero-mappings
export async function PUT(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const body = await request.json();

    const resolved = await resolveSessionOrganizationId(
      user.id,
      body.organizationId,
      'settings/xero-mappings PUT'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;
    const mappings = { ...body };
    delete mappings.organizationId;

    const canManageSettings = await hasOrganizationPermission(
      user.id,
      organizationId,
      'manage_settings'
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: 'Forbidden - insufficient organization permissions' },
        { status: 403 }
      );
    }

    // Standard exports need revenue; clearing accounts remain optional so setup does not
    // block standard businesses before an accountant reviews settlement details.
    const required = [
      'xero_revenue_account_id',
    ];
    const mappingFields = [
      'xero_revenue_account_id',
      'xero_receivable_account_id',
      'xero_stripe_clearing_account_id',
      'xero_hbar_clearing_account_id',
      'xero_usdc_clearing_account_id',
      'xero_usdt_clearing_account_id',
      'xero_audd_clearing_account_id',
      'xero_fee_expense_account_id',
    ];

    for (const field of required) {
      if (!mappings[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate no duplicate crypto clearing accounts
    const cryptoAccounts = [
      mappings.xero_stripe_clearing_account_id,
      mappings.xero_hbar_clearing_account_id,
      mappings.xero_usdc_clearing_account_id,
      mappings.xero_usdt_clearing_account_id,
      mappings.xero_audd_clearing_account_id,
    ].filter(Boolean);

    const uniqueCryptoAccounts = new Set(cryptoAccounts);
    if (uniqueCryptoAccounts.size !== cryptoAccounts.length) {
      return NextResponse.json(
        { error: 'Each clearing account must be mapped to a different Xero account' },
        { status: 400 }
      );
    }

    const mappedCodes = mappingFields
      .map((field) => mappings[field] as string)
      .filter(Boolean);
    const mappingValidation = await validateMappedAccountCodes(organizationId, mappedCodes);
    if (!mappingValidation.valid) {
      return NextResponse.json(
        {
          error: `Some mapped Xero account codes are no longer available: ${mappingValidation.missingCodes.join(', ')}. Refresh accounts and reselect valid options.`,
        },
        { status: 400 }
      );
    }

    // Update merchant settings
    const updated = await prisma.merchant_settings.updateMany({
      where: {
        organization_id: organizationId,
      },
      data: {
        xero_revenue_account_id: mappings.xero_revenue_account_id,
        xero_receivable_account_id: mappings.xero_receivable_account_id,
        xero_stripe_clearing_account_id: mappings.xero_stripe_clearing_account_id,
        xero_hbar_clearing_account_id: mappings.xero_hbar_clearing_account_id,
        xero_usdc_clearing_account_id: mappings.xero_usdc_clearing_account_id,
        xero_usdt_clearing_account_id: mappings.xero_usdt_clearing_account_id,
        xero_audd_clearing_account_id: mappings.xero_audd_clearing_account_id,
        xero_fee_expense_account_id: mappings.xero_fee_expense_account_id,
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Merchant settings not found' },
        { status: 404 }
      );
    }

    logger.info('Updated Xero account mappings', {
      organizationId,
      mappingsCount: mappedCodes.length,
    });

    const auditCtx = extractRequestAuditContext(request);
    void createAuditLog({
      eventType: AuditEventType.ADMIN_SETTINGS_CHANGED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      organizationId,
      resource: 'xero_mappings',
      resourceId: organizationId,
      action: 'update',
      newValue: JSON.stringify({ fieldsUpdated: mappedCodes.length }),
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
      correlationId: auditCtx.correlationId,
      timestamp: new Date(),
    });

    return NextResponse.json({
      data: { success: true, message: 'Mappings updated successfully' },
    });
  } catch (error) {
    logger.error('Error saving Xero mappings', { error });
    return NextResponse.json(
      { error: 'Failed to save mappings' },
      { status: 500 }
    );
  }
}






