/**
 * Xero Account Mappings API Endpoint
 * Manages saving and retrieving Xero account mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { AuditEventType, createAuditLog, AuditSeverity } from '@/lib/audit/audit-log';
import { extractRequestAuditContext } from '@/lib/audit/request-context.server';
import { prisma } from '@/lib/server/prisma';
import { log } from '@/lib/logger';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { fetchXeroAccounts } from '@/lib/xero/accounts-service';
import { validateXeroMappingDuplicates } from '@/lib/accounting/validate-xero-mapping-duplicates';
import {
  chartCodesFromAccounts,
  missingMappedAccountCodes,
  persistableXeroMappingCode,
  prepareXeroMappingsForPersistence,
  type XeroMappingSnapshot,
} from '@/lib/accounting/reconcile-xero-mappings';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { createClient } from '@/lib/supabase/server';

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
        xero_wise_clearing_account_id: true,
        xero_fee_expense_account_id: true,
        crypto_settlement_strategy: true,
      },
    });

    return NextResponse.json({ data: settings });
  } catch (error) {
    log.error('Error fetching Xero mappings', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/xero-mappings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const access = await requirePaymentConfigurationAccess(request, body.organizationId);
    if (!access.ok) return access.response;
    const user = access.user;
    const organizationId = access.organizationId;
    const mappings = { ...body } as XeroMappingSnapshot & Record<string, unknown>;
    delete mappings.organizationId;

    // Standard exports need revenue; clearing accounts remain optional so setup does not
    // block standard businesses before an accountant reviews settlement details.
    const required = [
      'xero_revenue_account_id',
    ] as const;

    if (
      mappings.crypto_settlement_strategy != null &&
      mappings.crypto_settlement_strategy !== 'shared' &&
      mappings.crypto_settlement_strategy !== 'per_asset'
    ) {
      return NextResponse.json(
        { error: 'crypto_settlement_strategy must be shared or per_asset' },
        { status: 400 }
      );
    }

    let chartAccounts: Awaited<ReturnType<typeof fetchXeroAccounts>>['accounts'];
    try {
      chartAccounts = (await fetchXeroAccounts(organizationId)).accounts;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Xero accounts';
      if (message.toLowerCase().includes('no active xero connection')) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      log.error('Error loading Xero chart while saving mappings', error);
      return NextResponse.json(
        { error: 'Could not load your Xero chart to verify account choices. Mappings were not changed.' },
        { status: 503 }
      );
    }

    const reconciled = prepareXeroMappingsForPersistence(mappings, {
      loaded: true,
      codes: chartCodesFromAccounts(chartAccounts),
    });
    const nextMappings = reconciled.mappings;

    for (const field of required) {
      if (!nextMappings[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    const duplicateValidation = validateXeroMappingDuplicates(nextMappings);
    if (!duplicateValidation.valid) {
      return NextResponse.json({ error: duplicateValidation.error }, { status: 400 });
    }

    const mappedCodes = [
      nextMappings.xero_revenue_account_id,
      nextMappings.xero_receivable_account_id,
      nextMappings.xero_stripe_clearing_account_id,
      nextMappings.xero_hbar_clearing_account_id,
      nextMappings.xero_usdc_clearing_account_id,
      nextMappings.xero_usdt_clearing_account_id,
      nextMappings.xero_audd_clearing_account_id,
      nextMappings.xero_wise_clearing_account_id,
      nextMappings.xero_fee_expense_account_id,
    ].filter((code): code is string => Boolean(code));
    const missingCodes = missingMappedAccountCodes(
      mappedCodes,
      chartCodesFromAccounts(chartAccounts)
    );
    if (missingCodes.length > 0) {
      return NextResponse.json(
        {
          error: `Some mapped Xero account codes are no longer available: ${missingCodes.join(', ')}. Refresh accounts and reselect valid options.`,
        },
        { status: 400 }
      );
    }

    // Update merchant settings. Empty/unresolved rails persist as null so
    // a missing Wise/USDT/AUDD mapping cannot block Stripe/USDC/HBAR.
    const updated = await prisma.merchant_settings.updateMany({
      where: {
        organization_id: organizationId,
      },
      data: {
        xero_revenue_account_id: persistableXeroMappingCode(nextMappings.xero_revenue_account_id),
        xero_receivable_account_id: persistableXeroMappingCode(nextMappings.xero_receivable_account_id),
        xero_stripe_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_stripe_clearing_account_id
        ),
        xero_hbar_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_hbar_clearing_account_id
        ),
        xero_usdc_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_usdc_clearing_account_id
        ),
        xero_usdt_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_usdt_clearing_account_id
        ),
        xero_audd_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_audd_clearing_account_id
        ),
        xero_wise_clearing_account_id: persistableXeroMappingCode(
          nextMappings.xero_wise_clearing_account_id
        ),
        xero_fee_expense_account_id: persistableXeroMappingCode(
          nextMappings.xero_fee_expense_account_id
        ),
        crypto_settlement_strategy: nextMappings.crypto_settlement_strategy ?? null,
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Merchant settings not found' },
        { status: 404 }
      );
    }

    log.info('Updated Xero account mappings', {
      organizationId,
      mappingsCount: mappedCodes.length,
      clearedStaleCount: reconciled.clearedMappings.length,
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
      newValue: JSON.stringify({
        fieldsUpdated: mappedCodes.length,
        clearedStaleCount: reconciled.clearedMappings.length,
      }),
      ipAddress: auditCtx.ipAddress,
      userAgent: auditCtx.userAgent,
      correlationId: auditCtx.correlationId,
      timestamp: new Date(),
    });

    return NextResponse.json({
      data: {
        success: true,
        message: 'Mappings updated successfully',
        clearedMappings: reconciled.clearedMappings,
      },
    });
  } catch (error) {
    log.error('Error saving Xero mappings', error);
    return NextResponse.json(
      { error: 'Failed to save mappings' },
      { status: 500 }
    );
  }
}






