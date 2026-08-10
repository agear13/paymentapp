/**
 * Historical accounting sync — preview unsynced commercial documents and queue on user confirmation.
 * GET  — list unsynced invoices/payments/settlements
 * POST — queue selected or all (never auto-runs on connect)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserForApi } from '@/lib/auth/api-session.server';
import { logger } from '@/lib/logger';
import {
  authorizeHistoricalAccountingSync,
  executeHistoricalAccountingSync,
  previewHistoricalAccountingSync,
} from '@/lib/accounting/historical-accounting-sync.server';

const postBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  paymentLinkIds: z.array(z.string().uuid()).optional(),
  syncAll: z.boolean().optional(),
});

function resolveOrganizationId(
  organizationId?: string,
  organization_id?: string
): string | undefined {
  return organizationId ?? organization_id;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;

    const { searchParams } = new URL(request.url);
    const organizationId = resolveOrganizationId(
      searchParams.get('organization_id') ?? undefined,
      searchParams.get('organizationId') ?? undefined
    );

    const authorized = await authorizeHistoricalAccountingSync({
      userId: auth.user.id,
      organizationId,
    });
    if (!authorized.ok) {
      return NextResponse.json(
        { error: authorized.error, code: authorized.code },
        { status: authorized.status }
      );
    }

    const preview = await previewHistoricalAccountingSync(authorized.organizationId);

    return NextResponse.json({
      success: true,
      organizationId: authorized.organizationId,
      ...preview,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'historical accounting sync preview failed');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getCurrentUserForApi(request);
    if (!auth.user) return auth.response!;

    const body = await request.json().catch(() => ({}));
    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const organizationId = resolveOrganizationId(
      parsed.data.organizationId,
      parsed.data.organization_id
    );

    const authorized = await authorizeHistoricalAccountingSync({
      userId: auth.user.id,
      organizationId,
    });
    if (!authorized.ok) {
      return NextResponse.json(
        { error: authorized.error, code: authorized.code },
        { status: authorized.status }
      );
    }

    const syncAll = parsed.data.syncAll === true;
    const paymentLinkIds = parsed.data.paymentLinkIds;
    if (!syncAll && (!paymentLinkIds || paymentLinkIds.length === 0)) {
      return NextResponse.json(
        { error: 'Provide paymentLinkIds or set syncAll to true' },
        { status: 400 }
      );
    }

    const result = await executeHistoricalAccountingSync({
      userId: authorized.userId,
      organizationId: authorized.organizationId,
      paymentLinkIds,
      syncAll,
    });

    return NextResponse.json({
      success: true,
      organizationId: authorized.organizationId,
      ...result,
      message:
        result.queued > 0
          ? `Queued ${result.queued} sync job${result.queued === 1 ? '' : 's'} for processing`
          : 'No sync jobs were queued',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: message }, 'historical accounting sync execute failed');
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
