/**
 * POST /api/xero/accounts/create-recommended-clearing
 * Creates missing recommended clearing accounts in the connected Xero organisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { hasOrganizationPermission } from '@/lib/auth/organization-access';
import { resolveSessionOrganizationId } from '@/lib/organization/resolve-organization-api.server';
import { resolveXeroConnectionForApi } from '@/lib/xero/connection-service';
import { createRecommendedClearingAccounts } from '@/lib/xero/create-recommended-clearing-accounts-service';
import { fetchXeroAccounts } from '@/lib/xero/accounts-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;
    const user = auth.user;

    const body = await request.json().catch(() => ({}));
    const resolved = await resolveSessionOrganizationId(
      user.id,
      body.organizationId,
      'xero/accounts/create-recommended-clearing'
    );
    if (resolved.response) return resolved.response;
    const organizationId = resolved.organizationId;

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

    const connectionResolved = await resolveXeroConnectionForApi(organizationId);
    if (!connectionResolved.persisted || connectionResolved.stale || !connectionResolved.connection) {
      return NextResponse.json(
        { error: 'No active Xero connection found. Please connect to Xero first.' },
        { status: 404 }
      );
    }

    const result = await createRecommendedClearingAccounts(organizationId);
    const { accounts } = await fetchXeroAccounts(organizationId);

    logger.info('Created recommended Xero clearing accounts', {
      organizationId,
      createdCount: result.created.length,
      existingCount: result.existing.length,
      failedCount: result.failed.length,
    });

    return NextResponse.json({
      data: {
        created: result.created.map((item) => ({
          rail: item.config.rail,
          accountName: item.config.accountName,
          mappingField: item.config.mappingField,
          account: item.account,
        })),
        existing: result.existing.map((item) => ({
          rail: item.config.rail,
          accountName: item.config.accountName,
          mappingField: item.config.mappingField,
          account: item.account,
        })),
        failed: result.failed,
        accounts,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error creating recommended clearing accounts', { error: message });
    return NextResponse.json(
      { error: 'Failed to create recommended clearing accounts', details: message },
      { status: 500 }
    );
  }
}
