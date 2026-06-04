/**
 * Xero Queue Backfill Endpoint (organization-scoped; global admin-only)
 * GET  — preview PAID links missing xero_syncs
 * POST — queue missing syncs
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  authorizeXeroBackfill,
  executeXeroBackfill,
  previewXeroBackfill,
  type XeroBackfillScope,
} from '@/lib/xero/xero-backfill.server';

const postBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  scope: z.enum(['organization', 'global']).optional(),
});

function resolveOrganizationId(
  organizationId?: string,
  organization_id?: string
): string | undefined {
  return organizationId ?? organization_id;
}

function resolveScope(
  scopeParam: string | null,
  bodyScope?: XeroBackfillScope
): XeroBackfillScope | undefined {
  if (bodyScope) return bodyScope;
  if (scopeParam === 'global' || scopeParam === 'organization') {
    return scopeParam;
  }
  return undefined;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null as null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, response: null };
}

/**
 * POST /api/xero/queue/backfill
 */
export async function POST(request: NextRequest) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (authResponse) return authResponse;

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
    const scope = resolveScope(null, parsed.data.scope);

    const auth = await authorizeXeroBackfill({
      userId: user!.id,
      organizationId,
      scope,
    });

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    const result = await executeXeroBackfill({
      userId: auth.userId,
      scope: auth.scope,
      organizationId: auth.organizationId,
    });

    if (result.queued === 0 && result.failed === 0) {
      return NextResponse.json({
        success: true,
        message: 'No payment links need backfilling',
        queued: 0,
        scope: result.scope,
        organizationId: result.organizationId,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${result.queued} syncs for processing`,
      scope: result.scope,
      organizationId: result.organizationId,
      results: {
        queued: result.queued,
        failed: result.failed,
        details: result.details,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ error: errorMessage }, 'Error during Xero sync backfill');

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * GET /api/xero/queue/backfill?organization_id=...&scope=organization|global
 */
export async function GET(request: NextRequest) {
  try {
    const { user, response: authResponse } = await requireUser();
    if (authResponse) return authResponse;

    const { searchParams } = new URL(request.url);
    const organizationId = resolveOrganizationId(
      searchParams.get('organization_id') ?? undefined,
      searchParams.get('organizationId') ?? undefined
    );
    const scope = resolveScope(searchParams.get('scope'), undefined);

    const auth = await authorizeXeroBackfill({
      userId: user!.id,
      organizationId,
      scope,
    });

    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, code: auth.code },
        { status: auth.status }
      );
    }

    const preview = await previewXeroBackfill({
      scope: auth.scope,
      organizationId: auth.organizationId,
    });

    return NextResponse.json({
      success: true,
      scope: preview.scope,
      organizationId: preview.organizationId,
      totalPaidLinks: preview.totalPaidLinks,
      linksWithSyncs: preview.linksWithSyncs,
      linksWithoutSyncs: preview.linksWithoutSyncs,
      previewLinks: preview.previewLinks.map((link) => ({
        paymentLinkId: link.paymentLinkId,
        shortCode: link.shortCode,
        amount: link.amount,
        currency: link.currency,
        paidAt: link.paidAt,
      })),
      message:
        preview.linksWithoutSyncs > 0
          ? `POST to this endpoint to queue ${preview.linksWithoutSyncs} syncs`
          : 'All paid links in scope already have syncs',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
