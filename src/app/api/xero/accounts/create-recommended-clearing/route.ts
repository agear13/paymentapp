/**
 * POST /api/xero/accounts/create-recommended-clearing
 * Creates missing recommended clearing accounts in the connected Xero organisation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePaymentConfigurationAccess } from '@/lib/auth/step-up.server';
import { resolveXeroConnectionForApi } from '@/lib/xero/connection-service';
import { createRecommendedClearingAccounts } from '@/lib/xero/create-recommended-clearing-accounts-service';
import { fetchXeroAccounts } from '@/lib/xero/accounts-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const access = await requirePaymentConfigurationAccess(request, body.organizationId);
    if (!access.ok) return access.response;
    const organizationId = access.organizationId;

    const connectionResolved = await resolveXeroConnectionForApi(organizationId);
    if (!connectionResolved.persisted || connectionResolved.stale || !connectionResolved.connection) {
      const reason = connectionResolved.stale
        ? 'Your Xero session has expired. Reconnect Xero above, then try again.'
        : 'Connect Xero above before creating clearing accounts.';
      return NextResponse.json(
        { error: 'No active Xero connection found. Please connect to Xero first.', details: reason },
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
