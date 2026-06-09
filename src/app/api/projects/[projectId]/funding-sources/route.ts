import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { applyRateLimit } from '@/lib/rate-limit';
import { CreateProjectFundingSourceSchema } from '@/lib/validations/schemas';
import {
  assertProjectOwnedByUser,
  createProjectFundingSource,
  listProjectFundingSources,
} from '@/lib/projects/funding-sources/funding-sources.server';
import { buildFundingSourceAuditEntry } from '@/lib/operations/audit/funding-source-audit';
import {
  orchestrateOperationalMutation,
  operationalSyncJson,
} from '@/lib/operations/orchestration/operational-mutation-orchestrator.server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const data = await listProjectFundingSources(user.id, projectId);
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/funding-sources GET]', e);
    return NextResponse.json({ error: 'Failed to load funding sources' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    const rateLimitResult = await applyRateLimit(request, 'api');
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireAuth(request);
    const { projectId } = await context.params;
    const owned = await assertProjectOwnedByUser(user.id, projectId);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = CreateProjectFundingSourceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await createProjectFundingSource(user.id, projectId, {
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

    const operationalSync = await orchestrateOperationalMutation({
      userId: user.id,
      mutation: 'funding_source_crud',
      projectId,
    });

    const fundingSourceAudit = buildFundingSourceAuditEntry({
      projectId,
      action: 'added',
      source: created,
    });

    return NextResponse.json(
      {
        data: created,
        fundingSourceAudit,
        ...operationalSyncJson(operationalSync),
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[projects/funding-sources POST]', e);
    return NextResponse.json({ error: 'Failed to create funding source' }, { status: 500 });
  }
}
