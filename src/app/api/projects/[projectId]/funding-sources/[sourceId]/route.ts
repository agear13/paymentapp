import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { UpdateProjectFundingSourceSchema } from '@/lib/validations/schemas';
import {
  assertProjectOwnedByUser,
  deleteProjectFundingSource,
  updateProjectFundingSource,
} from '@/lib/projects/funding-sources/funding-sources.server';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth();
    const { projectId, sourceId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateProjectFundingSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateProjectFundingSource(user.id, projectId, sourceId, {
      name: parsed.data.name,
      description: parsed.data.description,
      sourceType: parsed.data.sourceType,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      status: parsed.data.status,
      confidenceLevel: parsed.data.confidenceLevel,
      expectedSettlementDate: parsed.data.expectedSettlementDate,
      actualSettlementDate: parsed.data.actualSettlementDate,
      linkedInvoiceId: parsed.data.linkedInvoiceId,
      linkedPaymentId: parsed.data.linkedPaymentId,
      notes: parsed.data.notes,
      organizationId: parsed.data.organizationId,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Funding source not found' }, { status: 404 });
    }

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'funding_update',
      projectId,
    });

    return NextResponse.json({ data: updated, ...operationalSyncJson(operationalSync) });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/funding-sources PATCH]', e);
    return NextResponse.json({ error: 'Failed to update funding source' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  try {
    const user = await requireAuth();
    const { projectId, sourceId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const ok = await deleteProjectFundingSource(user.id, projectId, sourceId);
    if (!ok) {
      return NextResponse.json({ error: 'Funding source not found' }, { status: 404 });
    }

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'funding_update',
      projectId,
    });

    return NextResponse.json({ ok: true, ...operationalSyncJson(operationalSync) });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/funding-sources DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete funding source' }, { status: 500 });
  }
}
